/*
 * Which AI engine is in use:
 *  - 'server': our Cloud Run server (Vertex AI on Google Cloud — paid from GCP credits, no API key in the browser)
 *  - 'gemini': Gemini API directly from the browser with an AI Studio key
 */
import { useEffect } from 'react';
import { getSettings, notifyChange, useStoreVersion } from './store';
import type { Settings } from './types';

export interface ServerHealth {
  reachable: boolean;
  passcodeValid: boolean;
  passcodeConfigured: boolean;
  liveModels?: string[];
  error?: string;
}

let health: ServerHealth | null = null;
let checkedKey = '';
let inflight: Promise<ServerHealth> | null = null;

export function serverBase(s: Settings) {
  return (s.serverUrl || '').trim().replace(/\/+$/, '');
}

export function liveSocketUrl(s: Settings) {
  const base = serverBase(s);
  const origin = base || `${location.protocol}//${location.host}`;
  return `${origin.replace(/^http/, 'ws')}/api/live?passcode=${encodeURIComponent(s.passcode)}`;
}

/** Ask the server (same site, or Settings → server address) whether it is there and the passcode works. */
export function checkServer(s: Settings = getSettings(), force = false): Promise<ServerHealth> {
  const key = `${serverBase(s)}|${s.passcode}`;
  if (!force && health && checkedKey === key) return Promise.resolve(health);
  if (!force && inflight && checkedKey === key) return inflight;
  checkedKey = key;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  inflight = fetch(`${serverBase(s)}/api/health`, { headers: { 'x-app-passcode': s.passcode }, signal: ctrl.signal })
    .then(async (r) => {
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.server !== 'articulate') return { reachable: false, passcodeValid: false, passcodeConfigured: false };
      return {
        reachable: true,
        passcodeValid: !!j.passcodeValid,
        passcodeConfigured: !!j.passcodeConfigured,
        liveModels: j.liveModels,
      };
    })
    .catch((e) => ({ reachable: false, passcodeValid: false, passcodeConfigured: false, error: String(e?.message || e) }))
    .then((h) => {
      clearTimeout(t);
      health = h;
      inflight = null;
      notifyChange();
      return h;
    });
  return inflight;
}

export function cachedHealth() {
  return health;
}

/** The engine to use right now (sync; uses the last server check). */
export function currentEngine(s: Settings = getSettings()): 'server' | 'gemini' {
  if (s.engine === 'server') return 'server';
  if (s.engine === 'gemini') return 'gemini';
  return health?.reachable ? 'server' : 'gemini';
}

/** Same, but waits for the first server check when in auto mode. */
export async function engineFor(s: Settings = getSettings()): Promise<'server' | 'gemini'> {
  if (s.engine === 'auto' && (!health || checkedKey !== `${serverBase(s)}|${s.passcode}`)) await checkServer(s);
  return currentEngine(s);
}

/** Is the chosen engine ready to use (key present / passcode accepted)? */
export function engineReady(s: Settings = getSettings()) {
  const e = currentEngine(s);
  if (e === 'server') return !!health?.reachable && !!health.passcodeValid;
  return !!s.apiKey;
}

/** React hook: re-renders when the server status changes; checks the server on mount. */
export function useEngine() {
  useStoreVersion();
  const s = getSettings();
  useEffect(() => {
    checkServer(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.serverUrl, s.passcode]);
  const checking = s.engine !== 'gemini' && !cachedHealth();
  return { engine: currentEngine(s), ready: engineReady(s), checking, health: cachedHealth(), settings: s };
}
