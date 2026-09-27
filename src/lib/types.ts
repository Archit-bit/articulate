export type DrillKind = 'impromptu' | 'explain' | 'rephrase' | 'roleplay';

export interface Scores {
  clarity: number;
  structure: number;
  concision: number;
  confidence: number;
  language: number;
}

export interface Filler {
  word: string;
  count: number;
}

export interface Issue {
  quote: string;
  problem: string;
  fix: string;
}

export interface WordSwap {
  said: string;
  better: string;
  why: string;
}

/** What the coach model returns for one spoken attempt. */
export interface SpeechFeedback {
  transcript: string;
  fillers: Filler[];
  scores: Scores;
  overall: number;
  verdict: string;
  strengths: string[];
  issues: Issue[];
  wordSwaps: WordSwap[];
  delivery: string;
  fixNext: string;
  strongerVersion: string;
  vsPrevious?: string;
}

/** Numbers computed locally from the recording + transcript. */
export interface Metrics {
  durationSec: number;
  words: number;
  wpm: number;
  fillerCount: number;
  fillersPerMin: number;
}

export interface Attempt {
  at: number;
  prompt: string;
  label?: string;
  targetSec: number;
  feedback: SpeechFeedback;
  metrics: Metrics;
}

export interface Turn {
  role: 'you' | 'client';
  text: string;
}

export interface RoleplayScores {
  clarity: number;
  structure: number;
  listening: number;
  objectionHandling: number;
  confidence: number;
}

export interface Moment {
  clientSaid: string;
  youSaid: string;
  better: string;
  why: string;
}

export interface RoleplayDebrief {
  outcome: string;
  scores: RoleplayScores;
  overall: number;
  verdict: string;
  strengths: string[];
  moments: Moment[];
  wordSwaps: WordSwap[];
  fixNext: string;
}

export interface Session {
  id: string;
  kind: DrillKind;
  at: number;
  title: string;
  attempts?: Attempt[];
  transcript?: Turn[];
  debrief?: RoleplayDebrief;
  durationSec?: number;
}

export interface PhraseEntry {
  id: string;
  said: string;
  better: string;
  why: string;
  at: number;
  source: DrillKind;
  mastered?: boolean;
}

export interface Settings {
  apiKey: string;
  coachModel: string;
  liveModel: string;
  voice: string;
  aboutMe: string;
  /** Whether the key's Google project has billing on. Free tier = nothing is charged. */
  billingEnabled: boolean;
  /** Rupees per US dollar, for the cost estimate. */
  usdInr: number;
  /**
   * Where the AI runs. 'server' = our Cloud Run server on Google Cloud (Vertex AI, paid from GCP credits, no key needed).
   * 'gemini' = straight from the browser with a Gemini API key. 'auto' = server if this page was served by it.
   */
  engine: 'auto' | 'server' | 'gemini';
  /** Server address, only needed when the app is opened from a different host (e.g. Amplify). Empty = same site. */
  serverUrl: string;
  /** Team passcode for the server. */
  passcode: string;
}

/** One billable call, priced at the paid-tier rate at the time it happened. */
export interface UsageEntry {
  at: number;
  what: 'drill' | 'debrief' | 'roleplay' | 'other';
  model: string;
  usd: number;
  inputTokens?: number;
  outputTokens?: number;
  liveSec?: number;
  clientAudioSec?: number;
}

export interface Recording {
  blob: Blob;
  base64: string;
  durationSec: number;
}
