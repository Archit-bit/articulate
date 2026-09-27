/*
 * Articulate server — runs on Google Cloud Run.
 *
 * - Serves the built app (../dist).
 * - POST /api/generate  → Gemini on Vertex AI (drill feedback, debriefs, topics)
 * - WS   /api/live      → Gemini Live on Vertex AI (client roleplay), relayed both ways
 *
 * Auth to Google uses the Cloud Run service account (no API keys anywhere).
 * Access to this server is protected by a shared passcode (APP_PASSCODE).
 * Usage is billed to the Google Cloud project — i.e. your free-trial / promotional credits.
 */
import { GoogleGenAI, Modality } from '@google/genai';
import express from 'express';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8080);
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';
const PASSCODE = process.env.APP_PASSCODE || '';
/** Gemini 3.x models on Vertex are served from the global endpoint. */
const COACH_LOCATION = process.env.COACH_LOCATION || 'global';
/**
 * Live voice models to try, in order. gemini-3.8-live is allow-listed for some Vertex projects;
 * gemini-live-2.5-flash-native-audio is generally available in us-central1.
 */
const LIVE_CANDIDATES = (process.env.LIVE_MODELS ||
  'gemini-3.8-live@global,gemini-live-2.5-flash-native-audio@us-central1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [model, location = 'global'] = s.split('@');
    return { model, location };
  });

const MOCK = process.env.MOCK_AI === '1';
const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- AI clients
const clients = new Map();
async function ai(location) {
  if (MOCK) return (await import('./mock.mjs')).mockAi;
  if (!clients.has(location)) {
    clients.set(location, new GoogleGenAI({ vertexai: true, project: PROJECT || undefined, location }));
  }
  return clients.get(location);
}

// ---------------------------------------------------------------- passcode
function passOk(given) {
  if (!PASSCODE) return false;
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(PASSCODE);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------- http
const app = express();
app.disable('x-powered-by');
app.use('/api', (req, res, next) => {
  // The app may also be opened from another host (e.g. Amplify), so allow cross-origin calls.
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'content-type, x-app-passcode');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '30mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    server: 'articulate',
    provider: 'vertex',
    passcodeConfigured: !!PASSCODE,
    passcodeValid: passOk(req.get('x-app-passcode')),
    coachLocation: COACH_LOCATION,
    liveModels: LIVE_CANDIDATES.map((c) => `${c.model}@${c.location}`),
  });
});

app.post('/api/generate', async (req, res) => {
  if (!PASSCODE) return res.status(500).json({ error: 'Server is missing APP_PASSCODE. Redeploy with a passcode.' });
  if (!passOk(req.get('x-app-passcode'))) return res.status(401).json({ error: 'Wrong or missing team passcode.' });
  const { model, contents, config } = req.body || {};
  if (!model || !contents) return res.status(400).json({ error: 'model and contents are required' });
  try {
    const client = await ai(COACH_LOCATION);
    const r = await client.models.generateContent({ model, contents, config });
    res.json({ text: r.text ?? '', usageMetadata: r.usageMetadata ?? null, model });
  } catch (e) {
    const status = Number(e?.status) || 500;
    console.error('[generate]', model, status, e?.message);
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: String(e?.message || e) });
  }
});

app.use(express.static(join(here, '..', 'dist'), { maxAge: '1h', index: 'index.html' }));

// ---------------------------------------------------------------- live relay
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/api/live') return socket.destroy();
  if (!passOk(url.searchParams.get('passcode'))) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => handleLive(ws));
});

let preferredLive = 0; // index into LIVE_CANDIDATES that last worked

function handleLive(ws) {
  let session = null;
  let closed = false;
  let startMsg = null;
  let kickoff = null; // first clientContent, replayed if we fall back to another model
  let gotContent = false;
  let attempt = preferredLive;

  const send = (obj) => ws.readyState === 1 && ws.send(JSON.stringify(obj));

  async function connect() {
    const cand = LIVE_CANDIDATES[attempt];
    const client = await ai(cand.location);
    const config = { ...(startMsg.config || {}), responseModalities: [Modality.AUDIO] };
    session = await client.live.connect({
      model: cand.model,
      config,
      callbacks: {
        onmessage: (m) => {
          if (m?.serverContent) gotContent = true;
          send({ type: 'message', message: m });
        },
        onerror: (e) => send({ type: 'error', message: String(e?.message || 'Live connection error') }),
        onclose: (e) => {
          const reason = String(e?.reason || '');
          // Model not available to this project → try the next candidate once, before anything was said.
          const noAccess = e?.code === 1008 && /not found|does not have access|not supported/i.test(reason);
          if (!closed && noAccess && !gotContent && attempt + 1 < LIVE_CANDIDATES.length) {
            console.warn(`[live] ${cand.model}@${cand.location} unavailable (${reason}); falling back`);
            attempt += 1;
            session = null; // ignore audio until the fallback model is connected
            connect()
              .then(() => kickoff && session.sendClientContent(kickoff))
              .catch((err) => {
                send({ type: 'error', message: String(err?.message || err) });
                ws.close();
              });
            return;
          }
          if (!closed) {
            send({ type: 'close', code: e?.code, reason });
            closed = true;
            ws.close();
          }
        },
      },
    });
    preferredLive = attempt;
    send({ type: 'open', model: cand.model, location: cand.location });
  }

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    try {
      if (msg.type === 'start') {
        if (session) return;
        startMsg = msg;
        await connect();
      } else if (msg.type === 'audio' && session) {
        session.sendRealtimeInput({ audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' } });
      } else if (msg.type === 'content' && session) {
        const params = { turns: msg.turns, turnComplete: msg.turnComplete ?? true };
        if (!kickoff) kickoff = params;
        session.sendClientContent(params);
      } else if (msg.type === 'end') {
        closed = true;
        session?.close();
        ws.close();
      }
    } catch (e) {
      console.error('[live]', e?.message || e);
      send({ type: 'error', message: String(e?.message || e) });
    }
  });

  ws.on('close', () => {
    closed = true;
    try {
      session?.close();
    } catch {
      /* ignore */
    }
  });
}

server.listen(PORT, () => {
  console.log(
    `Articulate server on :${PORT} · project=${PROJECT || '(auto)'} · coach@${COACH_LOCATION} · live=${LIVE_CANDIDATES.map((c) => c.model + '@' + c.location).join(' → ')}${MOCK ? ' · MOCK AI' : ''}${PASSCODE ? '' : ' · WARNING: APP_PASSCODE not set, API disabled'}`,
  );
});
