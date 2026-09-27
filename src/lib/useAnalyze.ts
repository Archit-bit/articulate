import { useState } from 'react';
import { analyzeSpeech, computeMetrics, friendlyError } from './gemini';
import { addPhrases, getSettings } from './store';
import type { Attempt, DrillKind, Recording } from './types';

export interface TakeOptions {
  kind: DrillKind;
  prompt: string;
  label?: string;
  task: string;
  focus: string;
  targetSec: number;
  previous?: Attempt;
}

export interface Take {
  attempt: Attempt;
  audioUrl: string;
}

/** Sends a recording to the coach, computes metrics and files word swaps into the phrasebank. */
export function useAnalyze() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function analyze(rec: Recording, o: TakeOptions): Promise<Take | null> {
    setBusy(true);
    setError('');
    try {
      const fb = await analyzeSpeech(getSettings(), {
        audioBase64: rec.base64,
        durationSec: rec.durationSec,
        targetSec: o.targetSec,
        task: o.task,
        focus: o.focus,
        previous: o.previous
          ? { transcript: o.previous.feedback.transcript, fixNext: o.previous.feedback.fixNext }
          : undefined,
      });
      if (!o.previous) delete fb.vsPrevious;
      const attempt: Attempt = {
        at: Date.now(),
        prompt: o.prompt,
        label: o.label,
        targetSec: o.targetSec,
        feedback: fb,
        metrics: computeMetrics(fb, rec.durationSec),
      };
      addPhrases(fb.wordSwaps, o.kind);
      return { attempt, audioUrl: URL.createObjectURL(rec.blob) };
    } catch (e) {
      setError(friendlyError(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, analyze, setError };
}
