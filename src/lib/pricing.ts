/*
 * Paid-tier list prices, USD. Source: ai.google.dev/gemini-api/docs/pricing (checked Sept 2026).
 * These are ESTIMATES for your own budgeting. The real bill is on aistudio.google.com/usage and /billing.
 * On the free tier nothing is charged at all.
 */
import { logUsage } from './store';
import type { UsageEntry } from './types';

interface TokenPrice {
  inText: number; // per 1M input tokens (text/image/video)
  inAudio: number; // per 1M input tokens (audio)
  out: number; // per 1M output tokens, incl. thinking
}

const beforeJan2027 = () => Date.now() < Date.UTC(2027, 0, 1);

function tokenPrice(model: string): TokenPrice {
  if (model.startsWith('gemini-3.8-flash')) {
    const early = beforeJan2027();
    return { inText: early ? 0.75 : 1.5, inAudio: early ? 0.75 : 1.5, out: early ? 3.75 : 7.5 };
  }
  if (model.startsWith('gemini-3.5-flash-lite')) return { inText: 0.3, inAudio: 0.3, out: 2.5 };
  if (model.startsWith('gemini-3.1-flash-lite')) return { inText: 0.25, inAudio: 0.5, out: 1.5 };
  if (model.startsWith('gemini-3.5-flash')) return { inText: 1.5, inAudio: 1.5, out: 9 };
  // unknown model: assume the default coach model's price
  return { inText: 0.75, inAudio: 0.75, out: 3.75 };
}

/** Live voice (gemini-3.8-live and -extended-thinking): per minute of audio. */
export const LIVE_PER_MIN = { in: 0.005, out: 0.018 };

interface UsageMeta {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  promptTokensDetails?: { modality?: string; tokenCount?: number }[];
}

/** Price one generateContent call from the usage numbers Google returns with it. */
export function recordCall(what: UsageEntry['what'], model: string, u: UsageMeta | undefined) {
  if (!u) return;
  const p = tokenPrice(model);
  const details = u.promptTokensDetails ?? [];
  const audioIn = details.filter((d) => d.modality === 'AUDIO').reduce((t, d) => t + (d.tokenCount ?? 0), 0);
  const totalIn = u.promptTokenCount ?? 0;
  const textIn = Math.max(0, totalIn - audioIn);
  const out = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
  const usd = (textIn * p.inText + audioIn * p.inAudio + out * p.out) / 1e6;
  logUsage({ at: Date.now(), what, model, usd, inputTokens: totalIn, outputTokens: out });
}

/** Price a live roleplay from its length and how long the client spoke. */
export function recordLive(model: string, liveSec: number, clientAudioSec: number) {
  if (liveSec < 1) return;
  const usd = (liveSec / 60) * LIVE_PER_MIN.in + (clientAudioSec / 60) * LIVE_PER_MIN.out;
  logUsage({ at: Date.now(), what: 'roleplay', model, usd, liveSec, clientAudioSec });
}

export function formatMoney(usd: number, usdInr: number) {
  const inr = usd * usdInr;
  const r = inr < 1 ? inr.toFixed(2) : inr < 100 ? inr.toFixed(1) : Math.round(inr).toLocaleString('en-IN');
  const d = usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2);
  return { inr: `₹${r}`, usd: `$${d}` };
}
