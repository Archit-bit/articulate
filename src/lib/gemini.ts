import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { checkServer, engineFor, serverBase } from './engine';
import { recordCall } from './pricing';
import type { Metrics, RoleplayDebrief, Settings, SpeechFeedback, Turn } from './types';

export function getClient(s: Settings) {
  if (!s.apiKey) throw new Error('Add your Gemini API key in Settings first.');
  return new GoogleGenAI({ apiKey: s.apiKey });
}

/** Backup models tried, in order, when the chosen coach model is overloaded or out of free quota. */
/** Backups when the chosen model is overloaded. Different model generations tend to have separate capacity. */
export const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

const isBusy = (m: string) =>
  /\b50[023]\b|UNAVAILABLE|overloaded|high (load|demand)|capacity|try again later|INTERNAL|DEADLINE_EXCEEDED/i.test(m);
const isQuota = (m: string) => /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(m);
/** Model not enabled for this project (common on Vertex AI for the newest models). */
const isNoAccess = (m: string) => /Publisher model .* not found|does not have access to it|no longer available/i.test(m);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GenParams = Parameters<GoogleGenAI['models']['generateContent']>[0];

/**
 * generateContent that survives Google's "model is experiencing high load" errors:
 * retries the same model once, then falls back to the next model. Records cost for the model that answered.
 */
/** One model call through whichever engine is active. Returns the text and Google's usage numbers. */
async function callModel(
  s: Settings,
  model: string,
  params: Omit<GenParams, 'model'>,
): Promise<{ text: string | undefined; usageMetadata?: GenerateContentResponse['usageMetadata'] }> {
  if ((await engineFor(s)) === 'server') {
    const r = await fetch(`${serverBase(s)}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-passcode': s.passcode },
      body: JSON.stringify({ model, contents: params.contents, config: params.config }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${r.status} ${j.error || r.statusText}`);
    return { text: j.text, usageMetadata: j.usageMetadata ?? undefined };
  }
  const res = await getClient(s).models.generateContent({ ...params, model });
  return { text: res.text, usageMetadata: res.usageMetadata };
}

/**
 * generateContent that survives Google's "model is experiencing high load" errors:
 * retries the same model once, then falls back to the next model. Records cost for the model that answered.
 */
async function generate(
  s: Settings,
  what: 'drill' | 'debrief' | 'other',
  params: Omit<GenParams, 'model'>,
  opts: { quick?: boolean } = {},
) {
  const all = [s.coachModel, ...FALLBACK_MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  // quick = non-essential calls (AI topics): try two models once each, don't make the user wait
  const models = opts.quick ? all.slice(0, 2) : all;
  const tries = opts.quick ? 1 : 2;
  let last: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        const res = await callModel(s, model, params);
        recordCall(what, model, res.usageMetadata);
        if (model !== s.coachModel) console.info(`[articulate] ${s.coachModel} was busy — answered by ${model}`);
        return res;
      } catch (e) {
        last = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (isQuota(msg) || isNoAccess(msg)) break; // quota used up / model not enabled → next model
        if (!isBusy(msg)) throw e; // real error (bad key, bad request) → stop
        if (attempt + 1 < tries) await sleep(1200 + Math.random() * 800);
      }
    }
  }
  throw last;
}

/** True for "try again later" type failures (overload, quota) rather than real errors. */
export function isTemporary(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return isBusy(m) || isQuota(m);
}

/** Pulls Google's own error text out of the SDK's JSON-in-a-string error message. */
function googleMessage(raw: string): string {
  const i = raw.indexOf('{');
  if (i < 0) return raw;
  try {
    const j = JSON.parse(raw.slice(i));
    return j?.error?.message || raw;
  } catch {
    return raw;
  }
}

export const PROJECT_DENIED_HELP =
  'Your API key is valid, but Google has restricted the Google Cloud project behind it (“Your project has been denied access”). ' +
  'This is an account-level block on Google’s side, not a problem with the app. Fix: verify your Google account (phone + 2-Step Verification) ' +
  'and check the project in AI Studio / Cloud Console for an appeal banner — or create a key from a different Google account, or add billing. See README → “Project denied access”.';

/** Turns raw API errors into something you can act on — keeping Google's own words. */
export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const g = googleMessage(raw);
  if (/team passcode/i.test(raw)) return 'Wrong or missing team passcode — enter it in Settings → Engine.';
  if (/missing APP_PASSCODE/i.test(raw)) return 'The server has no passcode set. Redeploy it with deploy-gcp.sh.';
  if (/Publisher model .* not found|does not have access to it/i.test(raw))
    return `This model isn't enabled for your Google Cloud project yet. Pick another coach model in Settings. (Google: ${g})`;
  if (/denied access/i.test(raw)) return PROJECT_DENIED_HELP;
  if (/API key not valid|API_KEY_INVALID|API_KEY_SERVICE_BLOCKED/i.test(raw))
    return `Gemini says this API key is not valid for the Gemini API. Re-copy it from aistudio.google.com/apikey. (Google: ${g})`;
  if (/API key expired/i.test(raw)) return 'This API key has expired. Create a new one at aistudio.google.com/apikey.';
  if (/billing/i.test(raw)) return `Google says billing is required for this request. (Google: ${g})`;
  if (isBusy(raw))
    return 'Google’s Gemini servers are overloaded right now (“high demand”). I retried and tried 4 backup models — your recording is kept, so press “Try the analysis again” in a minute.';
  if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(raw))
    return 'Free-tier limit reached for now. Wait a minute, or switch the coach model to a Flash-Lite model in Settings.';
  if (/\b404\b|NOT_FOUND|no longer available|is not supported/i.test(raw))
    return `That model name is not available to your key. Pick another model in Settings. (Google: ${g})`;
  if (/PERMISSION_DENIED|\b403\b/i.test(raw)) return `Google refused the request (permission denied). Google says: ${g}`;
  if (/UNAUTHENTICATED|\b401\b/i.test(raw)) return `Google could not authenticate the key. Google says: ${g}`;
  if (/Failed to fetch|NetworkError|network/i.test(raw)) return 'Network error — are you online?';
  return g.length > 300 ? g.slice(0, 300) + '…' : g;
}

// ---------------------------------------------------------------------------
// Coach: analyse one spoken attempt
// ---------------------------------------------------------------------------

const COACH_SYSTEM = `You are an exacting but encouraging speaking coach — a senior communication coach who trains consultants and sales leaders on articulation: clear thinking, clear structure, clear words.

You receive a recording of the speaker and give precise, actionable feedback.

Rules:
- Transcribe EXACTLY what was said, verbatim, including filler words (um, uh, like, basically, actually, you know, so, right, matlab, na, haan), false starts and repetitions. Write any Hindi words in Latin script. The speaker may mix Hindi and English — that is fine; only flag it if it would hurt clarity in a formal client setting.
- Judge what you HEAR, not just the words: pace, pauses, hesitation, trailing off, vocal energy and confidence.
- Be specific. Quote their exact words when you point out a problem. Never give generic advice ("be more confident") without saying exactly how.
- Scores are 1–10 and must be honest: 5 = average working professional, 7 = good, 9+ = exceptional. Do not inflate.
  • clarity — is the main point obvious and easy to follow?
  • structure — logical order, a clear opening and a clear close, signposting
  • concision — no rambling, repetition or padding
  • confidence — assertive phrasing and steady delivery; penalise hedging ("I think maybe", "kind of"), uptalk, trailing off, long hesitations
  • language — precise, appropriate vocabulary and grammar
- "fillers": each distinct filler word/phrase you heard and how many times. Only count words used as fillers, not when used meaningfully.
- "issues": at most 3, most important first. "quote" must be their exact words.
- "wordSwaps": 0–4, only where a more precise or professional word or phrase clearly helps. "said" must be their exact words.
- "fixNext": ONE concrete instruction for the very next attempt.
- "strongerVersion": keep THEIR ideas and natural voice, fit the time limit, and make it sound spoken, not written. No bullet points.
- "delivery": 1–2 sentences on pace, pauses and tone based on the audio.
- If the recording is silent or unintelligible, say so in "verdict", give every score 1, and leave the lists empty.`;

const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    transcript: { type: 'string' },
    fillers: {
      type: 'array',
      items: {
        type: 'object',
        properties: { word: { type: 'string' }, count: { type: 'integer' } },
        required: ['word', 'count'],
      },
    },
    scores: {
      type: 'object',
      properties: {
        clarity: { type: 'integer' },
        structure: { type: 'integer' },
        concision: { type: 'integer' },
        confidence: { type: 'integer' },
        language: { type: 'integer' },
      },
      required: ['clarity', 'structure', 'concision', 'confidence', 'language'],
    },
    overall: { type: 'integer' },
    verdict: { type: 'string', description: 'One honest sentence summing up the attempt.' },
    strengths: { type: 'array', items: { type: 'string' }, description: '1–2 specific things that worked.' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: { quote: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } },
        required: ['quote', 'problem', 'fix'],
      },
    },
    wordSwaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { said: { type: 'string' }, better: { type: 'string' }, why: { type: 'string' } },
        required: ['said', 'better', 'why'],
      },
    },
    delivery: { type: 'string' },
    fixNext: { type: 'string' },
    strongerVersion: { type: 'string' },
    vsPrevious: { type: 'string', description: 'Only for retries: what concretely improved or did not.' },
  },
  required: [
    'transcript',
    'fillers',
    'scores',
    'overall',
    'verdict',
    'strengths',
    'issues',
    'wordSwaps',
    'delivery',
    'fixNext',
    'strongerVersion',
  ],
};

export interface AnalyzeInput {
  audioBase64: string;
  durationSec: number;
  targetSec: number;
  task: string; // what they were asked to do
  focus: string; // drill-specific judging notes
  previous?: { transcript: string; fixNext: string };
}

export async function analyzeSpeech(s: Settings, input: AnalyzeInput): Promise<SpeechFeedback> {
  const lines = [
    `TASK GIVEN TO THE SPEAKER: ${input.task}`,
    `TIME LIMIT: ${input.targetSec} seconds. ACTUAL LENGTH: ${Math.round(input.durationSec)} seconds.`,
    `WHAT TO JUDGE ESPECIALLY: ${input.focus}`,
  ];
  if (s.aboutMe.trim()) lines.push(`ABOUT THE SPEAKER (for context): ${s.aboutMe.trim()}`);
  if (input.previous) {
    lines.push(
      `THIS IS A RETRY. Previous attempt transcript: """${input.previous.transcript}"""`,
      `Your instruction for this retry was: "${input.previous.fixNext}". Fill "vsPrevious" with 1–2 concrete sentences on what improved and what did not.`,
    );
  }
  lines.push('Analyse the attached recording and return the JSON.');

  const res = await generate(s, 'drill', {
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: 'audio/wav', data: input.audioBase64 } }, { text: lines.join('\n') }],
      },
    ],
    config: {
      systemInstruction: COACH_SYSTEM,
      responseMimeType: 'application/json',
      responseJsonSchema: FEEDBACK_SCHEMA,
      temperature: 0.4,
    },
  });
  const fb = parseJson<SpeechFeedback>(res.text);
  fb.fillers ??= [];
  fb.issues ??= [];
  fb.wordSwaps ??= [];
  fb.strengths ??= [];
  return fb;
}

export function computeMetrics(fb: SpeechFeedback, durationSec: number): Metrics {
  const words = (fb.transcript.match(/[\p{L}\p{N}'’]+/gu) ?? []).length;
  const mins = Math.max(durationSec, 1) / 60;
  const fillerCount = fb.fillers.reduce((n, f) => n + (f.count || 0), 0);
  return {
    durationSec: Math.round(durationSec),
    words,
    wpm: Math.round(words / mins),
    fillerCount,
    fillersPerMin: Math.round((fillerCount / mins) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Roleplay: persona prompt + post-meeting debrief
// ---------------------------------------------------------------------------

export interface RoleplaySetup {
  persona: string;
  situation: string;
  goal: string;
  concerns: string;
  difficultyText: string;
}

export function personaPrompt(r: RoleplaySetup, aboutMe: string) {
  return `You are role-playing a realistic business conversation so the user can practise.

YOUR CHARACTER: ${r.persona}
SITUATION: ${r.situation}
THE USER: ${aboutMe.trim() || 'A representative of a technology company.'}
THE USER'S GOAL (do not reveal that you know it): ${r.goal}

How to behave:
- Stay fully in character for the whole conversation. Never say you are an AI and never coach or give feedback during the conversation.
- Speak the way a real Indian professional speaks in a meeting: natural spoken sentences, usually 1–3 per turn. Mostly English; an occasional Hindi phrase is fine if the user uses Hindi.
- ${r.difficultyText}
- Bring up these concerns naturally over the conversation, one at a time, not all at once: ${r.concerns || 'whatever a real person in your position would worry about'}.
- If the user is vague or rambles, react like a real person would — ask what exactly they mean, or ask for the bottom line.
- Ask follow-up questions that test whether the user actually understands your situation.
- Only agree to the user's goal if they earn it with clear, credible answers. If they do earn it, agree and propose the next step.
- Start the conversation yourself: greet the user briefly in character and open with a question.`;
}

const DEBRIEF_SCHEMA = {
  type: 'object',
  properties: {
    outcome: { type: 'string', description: 'Where the meeting ended up vs. the goal, in 1–2 sentences.' },
    scores: {
      type: 'object',
      properties: {
        clarity: { type: 'integer' },
        structure: { type: 'integer' },
        listening: { type: 'integer' },
        objectionHandling: { type: 'integer' },
        confidence: { type: 'integer' },
      },
      required: ['clarity', 'structure', 'listening', 'objectionHandling', 'confidence'],
    },
    overall: { type: 'integer' },
    verdict: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    moments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          clientSaid: { type: 'string' },
          youSaid: { type: 'string' },
          better: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['clientSaid', 'youSaid', 'better', 'why'],
      },
    },
    wordSwaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { said: { type: 'string' }, better: { type: 'string' }, why: { type: 'string' } },
        required: ['said', 'better', 'why'],
      },
    },
    fixNext: { type: 'string' },
  },
  required: ['outcome', 'scores', 'overall', 'verdict', 'strengths', 'moments', 'wordSwaps', 'fixNext'],
};

export async function debriefRoleplay(
  s: Settings,
  r: RoleplaySetup,
  transcript: Turn[],
  durationSec: number,
): Promise<RoleplayDebrief> {
  const convo = transcript.map((t) => `${t.role === 'you' ? 'USER' : 'CLIENT'}: ${t.text}`).join('\n');
  const prompt = `You coach professionals on client conversations. Below is a transcript of a practice meeting (speech-to-text, so ignore small transcription errors).

The client was: ${r.persona}
Situation: ${r.situation}
The user's goal: ${r.goal}
Meeting length: ${Math.round(durationSec / 60)} min.
${s.aboutMe.trim() ? `About the user: ${s.aboutMe.trim()}` : ''}

TRANSCRIPT:
${convo}

Debrief the USER (not the client). Be honest and specific; 5 = average professional, 7 = good, 9+ = exceptional.
- scores: clarity, structure (of answers), listening (did they understand and address what was actually asked?), objectionHandling, confidence.
- moments: the 2–4 most important moments where a better answer would have changed the meeting. Quote the client and the user exactly; give the better answer as it should be SPOKEN, in the user's voice.
- wordSwaps: 0–4 exact phrases the user said → a sharper alternative.
- fixNext: ONE concrete thing to do differently next time.
If the transcript is too short to judge, say so in verdict and keep lists short.`;

  const res = await generate(s, 'debrief', {
    contents: prompt,
    config: { responseMimeType: 'application/json', responseJsonSchema: DEBRIEF_SCHEMA, temperature: 0.4 },
  });
  const d = parseJson<RoleplayDebrief>(res.text);
  d.moments ??= [];
  d.wordSwaps ??= [];
  d.strengths ??= [];
  return d;
}

// ---------------------------------------------------------------------------
// Fresh practice material
// ---------------------------------------------------------------------------

export async function freshPrompt(s: Settings, kind: 'impromptu' | 'rephrase'): Promise<{ text: string; context?: string }> {
  const about = s.aboutMe.trim() ? `About me: ${s.aboutMe.trim()}\n` : '';
  const ask =
    kind === 'impromptu'
      ? `${about}Give me ONE impromptu speaking prompt (a question or situation) I can talk about for 60–90 seconds with no preparation. Make it thought-provoking and relevant to a working professional${about ? ' like me' : ''}. Vary the type: opinion, story, explain, or on-the-spot business situation. Return JSON {"text": "..."}.`
      : `${about}Give me ONE blunt, slightly awkward workplace sentence that a professional${about ? ' like me' : ''} might need to say to a client, boss or colleague (e.g. delivering bad news, saying no, asking for money). I will practise rephrasing it. Return JSON {"text": "the blunt sentence", "context": "who I am saying it to, in 3–6 words"}.`;
  const res = await generate(
    s,
    'other',
    { contents: ask, config: { responseMimeType: 'application/json', temperature: 1.1 } },
    { quick: true },
  );
  return parseJson(res.text);
}

/**
 * Two-step check so the message says exactly what is wrong:
 * 1) is the key itself accepted (list models)?  2) can it actually generate with the chosen models?
 */
export async function testKey(s: Settings): Promise<{ ok: boolean; message: string }> {
  if ((await engineFor(s)) === 'server') {
    const h = await checkServer(s, true);
    if (!h.reachable) return { ok: false, message: 'Could not reach the Articulate server. Check the server address.' };
    if (!h.passcodeConfigured) return { ok: false, message: 'The server has no passcode set. Redeploy it with deploy-gcp.sh.' };
    if (!h.passcodeValid) return { ok: false, message: 'Server found, but the team passcode is wrong.' };
    try {
      const res = await callModel(s, s.coachModel, { contents: 'Reply with the single word: ready' });
      recordCall('other', s.coachModel, res.usageMetadata);
      return { ok: true, message: `Connected to Google Cloud ✓ — ${s.coachModel} replied “${(res.text ?? '').trim().slice(0, 20)}”. Paid from your Google Cloud credits.` };
    } catch (e) {
      return { ok: false, message: friendlyError(e) };
    }
  }
  if (!s.apiKey) return { ok: false, message: 'Paste a key first.' };
  const base = 'https://generativelanguage.googleapis.com/v1beta';
  const list = await fetch(`${base}/models?pageSize=200`, { headers: { 'x-goog-api-key': s.apiKey } });
  const listBody = await list.json().catch(() => ({}));
  if (!list.ok) return { ok: false, message: friendlyError(new Error(JSON.stringify(listBody))) };

  const names: string[] = (listBody.models ?? []).map((m: { name: string }) => m.name.replace('models/', ''));
  const missing = [s.coachModel, s.liveModel].filter((m) => names.length && !names.includes(m));
  if (missing.length)
    return { ok: false, message: `Key accepted, but these models are not available to it: ${missing.join(', ')}. Pick others below.` };

  try {
    const ai = getClient(s);
    const res = await ai.models.generateContent({ model: s.coachModel, contents: 'Reply with the single word: ready' });
    recordCall('other', s.coachModel, res.usageMetadata);
    return { ok: true, message: `Connected ✓ — ${s.coachModel} replied “${(res.text ?? '').trim().slice(0, 20)}”. You’re ready.` };
  } catch (e) {
    return { ok: false, message: friendlyError(e) };
  }
}

function parseJson<T>(text: string | undefined): T {
  if (!text) throw new Error('The coach returned an empty response. Try again.');
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error('Could not read the coach’s response. Try again.');
  }
}
