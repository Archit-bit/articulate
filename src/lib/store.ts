import { useSyncExternalStore } from 'react';
import type { Attempt, DrillKind, PhraseEntry, Session, Settings, UsageEntry, WordSwap } from './types';

/*
 * Everything lives in this browser's localStorage. No server, no account.
 * Use Settings → Export to back it up.
 */

const K = {
  settings: 'articulate.settings',
  sessions: 'articulate.sessions',
  phrases: 'articulate.phrases',
  usage: 'articulate.usage',
};

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  coachModel: 'gemini-3.8-flash',
  liveModel: 'gemini-3.8-live',
  voice: '',
  aboutMe: '',
  billingEnabled: false,
  usdInr: 96,
  engine: 'auto',
  serverUrl: '',
  passcode: '',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Could not save', key, e);
  }
}

// ---- tiny reactive layer -------------------------------------------------
let version = 0;
const listeners = new Set<() => void>();
function bump() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
/** Tell subscribed components that something outside localStorage changed (e.g. server status). */
export const notifyChange = () => bump();
/** Re-render the calling component whenever stored data changes. */
export function useStoreVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

// ---- settings ------------------------------------------------------------
/**
 * Optional fallback key from `.env.local` (VITE_GEMINI_API_KEY=...) — LOCAL DEV ONLY.
 * Production builds (the hosted version) never contain a key; each person pastes their own in Settings.
 */
const ENV_KEY: string = import.meta.env.DEV ? String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim() : '';

export function getSettings(): Settings {
  const stored = read<Partial<Settings>>(K.settings, {});
  return { ...DEFAULT_SETTINGS, ...stored, apiKey: stored.apiKey || ENV_KEY };
}
export function saveSettings(s: Settings) {
  write(K.settings, s);
  bump();
}

// ---- sessions ------------------------------------------------------------
export function getSessions(): Session[] {
  return read<Session[]>(K.sessions, []).sort((a, b) => b.at - a.at);
}
export function upsertSession(s: Session) {
  const all = read<Session[]>(K.sessions, []);
  const i = all.findIndex((x) => x.id === s.id);
  if (i >= 0) all[i] = s;
  else all.push(s);
  write(K.sessions, all);
  bump();
}
export function deleteSession(id: string) {
  write(
    K.sessions,
    read<Session[]>(K.sessions, []).filter((s) => s.id !== id),
  );
  bump();
}

// ---- phrasebank ----------------------------------------------------------
export function getPhrases(): PhraseEntry[] {
  return read<PhraseEntry[]>(K.phrases, []).sort((a, b) => b.at - a.at);
}
export function addPhrases(swaps: WordSwap[], source: DrillKind) {
  if (!swaps?.length) return;
  const all = read<PhraseEntry[]>(K.phrases, []);
  const key = (s: { said: string; better: string }) =>
    (s.said + '→' + s.better).toLowerCase().trim();
  const seen = new Set(all.map(key));
  for (const s of swaps) {
    if (!s.said || !s.better || seen.has(key(s))) continue;
    seen.add(key(s));
    all.push({ id: uid(), ...s, at: Date.now(), source });
  }
  write(K.phrases, all);
  bump();
}
export function updatePhrase(id: string, patch: Partial<PhraseEntry>) {
  write(
    K.phrases,
    read<PhraseEntry[]>(K.phrases, []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
  );
  bump();
}
export function deletePhrase(id: string) {
  write(
    K.phrases,
    read<PhraseEntry[]>(K.phrases, []).filter((p) => p.id !== id),
  );
  bump();
}

// ---- usage & cost --------------------------------------------------------
export function getUsage(): UsageEntry[] {
  return read<UsageEntry[]>(K.usage, []);
}
export function logUsage(e: UsageEntry) {
  if (!(e.usd >= 0)) return;
  const all = read<UsageEntry[]>(K.usage, []);
  all.push(e);
  write(K.usage, all.slice(-5000));
  bump();
}
export function usageSummary(since = 0) {
  const rows = getUsage().filter((u) => u.at >= since);
  return {
    usd: rows.reduce((t, u) => t + u.usd, 0),
    drills: rows.filter((u) => u.what === 'drill').length,
    drillUsd: rows.filter((u) => u.what === 'drill').reduce((t, u) => t + u.usd, 0),
    roleplayMin: rows.filter((u) => u.what === 'roleplay').reduce((t, u) => t + (u.liveSec ?? 0), 0) / 60,
    calls: rows.length,
  };
}

// ---- backup --------------------------------------------------------------
export function exportAll() {
  const s = getSettings();
  return {
    exportedAt: new Date().toISOString(),
    settings: { ...s, apiKey: '' },
    sessions: getSessions(),
    phrases: getPhrases(),
    usage: getUsage(),
  };
}
export function importAll(data: { sessions?: Session[]; phrases?: PhraseEntry[]; usage?: UsageEntry[] }) {
  if (Array.isArray(data.sessions)) write(K.sessions, data.sessions);
  if (Array.isArray(data.phrases)) write(K.phrases, data.phrases);
  if (Array.isArray(data.usage)) write(K.usage, data.usage);
  bump();
}
export function clearAll() {
  write(K.sessions, []);
  write(K.phrases, []);
  write(K.usage, []);
  bump();
}

// ---- helpers & stats -----------------------------------------------------
export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function dayKey(ts: number) {
  return new Date(ts).toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
}

export function allAttempts(sessions = getSessions()): (Attempt & { kind: DrillKind })[] {
  return sessions
    .flatMap((s) => (s.attempts ?? []).map((a) => ({ ...a, kind: s.kind })))
    .sort((a, b) => a.at - b.at);
}

export function stats() {
  const sessions = getSessions();
  const days = new Set(sessions.map((s) => dayKey(s.at)));
  const today = dayKey(Date.now());

  // streak: consecutive days ending today (or yesterday, so it isn't lost before you practise)
  let streak = 0;
  const d = new Date();
  if (!days.has(today)) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d.getTime()))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = sessions.filter((s) => s.at >= weekAgo).length;
  const doneToday = new Set(sessions.filter((s) => dayKey(s.at) === today).map((s) => s.kind));

  const attempts = allAttempts(sessions);
  const recent = attempts.slice(-12);
  const dims = ['clarity', 'structure', 'concision', 'confidence', 'language'] as const;
  const avg = Object.fromEntries(
    dims.map((k) => [
      k,
      recent.length ? recent.reduce((t, a) => t + (a.feedback.scores?.[k] ?? 0), 0) / recent.length : 0,
    ]),
  ) as Record<(typeof dims)[number], number>;
  const weakest = recent.length ? dims.reduce((w, k) => (avg[k] < avg[w] ? k : w), dims[0]) : null;

  const roleplays = sessions.filter((s) => s.kind === 'roleplay' && s.debrief);
  const fixes = [
    ...attempts.slice(-4).map((a) => ({ at: a.at, text: a.feedback.fixNext })),
    ...roleplays.slice(0, 2).map((s) => ({ at: s.at, text: s.debrief!.fixNext })),
  ]
    .filter((f) => f.text)
    .sort((a, b) => b.at - a.at)
    .filter((f, i, arr) => arr.findIndex((x) => x.text === f.text) === i)
    .slice(0, 3);

  return {
    streak,
    thisWeek,
    totalSessions: sessions.length,
    practiceDays: days.size,
    doneToday,
    attempts,
    avg,
    weakest,
    fixes,
  };
}
