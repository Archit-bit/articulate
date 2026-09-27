/*
 * One interface for the live roleplay connection, whichever engine is in use:
 *  - direct: browser → Gemini Live API with the API key
 *  - server: browser → our Cloud Run server → Gemini Live on Vertex AI (Google Cloud credits)
 */
import { Modality, type LiveConnectConfig } from '@google/genai';
import { engineFor, liveSocketUrl } from './engine';
import { friendlyError, getClient } from './gemini';
import type { Settings } from './types';

/** The parts of a Live API server message the app uses. */
export interface LiveMessage {
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
  };
  goAway?: unknown;
}

export interface LiveCallbacks {
  onmessage: (m: LiveMessage) => void;
  onerror: (message: string) => void;
  onclose: (reason: string) => void;
}

export interface LiveHandle {
  sendAudio: (base64Pcm16k: string) => void;
  sendText: (text: string) => void;
  close: () => void;
  /** Which model actually answered (server may fall back). */
  model: string;
}

export async function openLive(s: Settings, config: LiveConnectConfig, cb: LiveCallbacks): Promise<LiveHandle> {
  const engine = await engineFor(s);
  return engine === 'server' ? openViaServer(s, config, cb) : openDirect(s, config, cb);
}

async function openDirect(s: Settings, config: LiveConnectConfig, cb: LiveCallbacks): Promise<LiveHandle> {
  const ai = getClient(s);
  const session = await ai.live.connect({
    model: s.liveModel,
    config: { ...config, responseModalities: [Modality.AUDIO] },
    callbacks: {
      onmessage: (m) => cb.onmessage(m as LiveMessage),
      onerror: (e) => cb.onerror(friendlyError(e?.message || 'Connection error')),
      onclose: (e) => cb.onclose(e?.reason || ''),
    },
  });
  return {
    model: s.liveModel,
    sendAudio: (data) => session.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } }),
    sendText: (text) => session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }),
    close: () => session.close(),
  };
}

function openViaServer(s: Settings, config: LiveConnectConfig, cb: LiveCallbacks): Promise<LiveHandle> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(liveSocketUrl(s));
    let opened = false;
    let ended = false;
    const send = (o: unknown) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(o));

    const handle: LiveHandle = {
      model: 'server',
      sendAudio: (data) => send({ type: 'audio', data }),
      sendText: (text) => send({ type: 'content', turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }),
      close: () => {
        ended = true;
        send({ type: 'end' });
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      },
    };

    ws.onopen = () => send({ type: 'start', config });
    ws.onmessage = (ev) => {
      let msg: { type: string; message?: LiveMessage; model?: string; reason?: string } | null = null;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (!msg) return;
      if (msg.type === 'open') {
        handle.model = msg.model ?? 'server';
        if (!opened) {
          opened = true;
          resolve(handle);
        }
      } else if (msg.type === 'message' && msg.message) cb.onmessage(msg.message);
      else if (msg.type === 'error') {
        const text = friendlyError(new Error((msg as { message?: string }).message ?? 'Server error'));
        if (!opened) reject(new Error(text));
        else cb.onerror(text);
      } else if (msg.type === 'close') {
        if (!ended) cb.onclose(msg.reason ?? '');
      }
    };
    ws.onerror = () => {
      if (!opened) reject(new Error('Could not reach the Articulate server for live voice. Check the passcode and server address in Settings.'));
    };
    ws.onclose = (ev) => {
      if (!opened) reject(new Error(ev.code === 1006 ? 'The server refused the connection — is the team passcode right?' : 'Live connection closed.'));
      else if (!ended) cb.onclose(ev.reason || '');
    };
  });
}
