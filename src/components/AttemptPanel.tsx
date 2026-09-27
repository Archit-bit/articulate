import { useEffect, useState, type ReactNode } from 'react';
import { useAnalyze, type Take, type TakeOptions } from '../lib/useAnalyze';
import type { Recording } from '../lib/types';
import Recorder from './Recorder';
import Scorecard from './Scorecard';

interface Props {
  opts: Omit<TakeOptions, 'previous'>;
  prepSec: number;
  takes: Take[];
  onTake: (t: Take) => void;
  /** Extra buttons shown next to "Retry" once there is feedback (e.g. Next topic). */
  actions?: ReactNode;
  allowRetry?: boolean;
}

/**
 * The core practice loop: speak → coach feedback → retry with one fix → compare.
 */
export default function AttemptPanel({ opts, prepSec, takes, onTake, actions, allowRetry = true }: Props) {
  const { busy, error, analyze } = useAnalyze();
  const [recording, setRecording] = useState(takes.length === 0);
  const [shown, setShown] = useState(takes.length - 1);
  const [pending, setPending] = useState<Recording | null>(null);

  useEffect(() => setShown(takes.length - 1), [takes.length]);

  const latest = takes.at(-1);

  async function handle(rec: Recording) {
    setPending(rec);
    const t = await analyze(rec, { ...opts, previous: latest?.attempt });
    if (t) {
      setPending(null);
      setRecording(false);
      onTake(t);
    }
  }

  if (busy) {
    return (
      <div className="card analyzing">
        <div className="spinner" />
        <div>
          <b>Your coach is listening back…</b>
          <div className="muted small">Transcribing, counting fillers, checking structure. Usually 5–15 seconds.</div>
        </div>
      </div>
    );
  }

  if (recording || !latest) {
    return (
      <div className="card">
        {latest && (
          <div className="retry-focus">
            <span className="tag">Attempt {takes.length + 1}</span> Focus: {latest.attempt.feedback.fixNext}
          </div>
        )}
        <Recorder
          targetSec={opts.targetSec}
          prepSec={prepSec}
          onDone={handle}
          hint={latest ? 'Same prompt — apply the fix' : 'Tap to speak'}
        />
        {error && (
          <div className="error">
            {error}{' '}
            {pending && (
              <button className="link" onClick={() => handle(pending)}>
                Try the analysis again
              </button>
            )}
          </div>
        )}
        {latest && (
          <button className="link" onClick={() => setRecording(false)}>
            ← Back to feedback
          </button>
        )}
      </div>
    );
  }

  const cur = takes[Math.max(0, Math.min(shown, takes.length - 1))];
  return (
    <div className="card">
      {takes.length > 1 && (
        <div className="tabs">
          {takes.map((t, i) => (
            <button key={i} className={i === shown ? 'active' : ''} onClick={() => setShown(i)}>
              Attempt {i + 1} · {t.attempt.feedback.overall}/10
            </button>
          ))}
        </div>
      )}
      <Scorecard attempt={cur.attempt} audioUrl={cur.audioUrl} />
      <div className="actions">
        {allowRetry && (
          <button className="primary" onClick={() => setRecording(true)}>
            Retry — apply the fix
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}
