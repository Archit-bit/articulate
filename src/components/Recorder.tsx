import { useCallback, useEffect, useRef, useState } from 'react';
import { TakeRecorder } from '../lib/audio';
import type { Recording } from '../lib/types';

interface Props {
  targetSec: number;
  prepSec?: number;
  disabled?: boolean;
  hint?: string;
  onDone: (rec: Recording) => void;
}

export function fmt(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Big record button with think-time, timer ring and live mic level. Space bar toggles. */
export default function Recorder({ targetSec, prepSec = 0, disabled, hint, onDone }: Props) {
  const [phase, setPhase] = useState<'idle' | 'prep' | 'rec' | 'saving'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [prepLeft, setPrepLeft] = useState(prepSec);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const rec = useRef<TakeRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const hardStop = targetSec + Math.max(10, Math.round(targetSec * 0.25));

  const clear = () => window.clearInterval(timer.current);

  const beginRecording = useCallback(async () => {
    clear();
    setError('');
    try {
      const r = new TakeRecorder();
      r.onLevel = (l) => setLevel(l);
      await r.start();
      rec.current = r;
      setElapsed(0);
      setPhase('rec');
      const t0 = performance.now();
      timer.current = window.setInterval(() => setElapsed((performance.now() - t0) / 1000), 200);
    } catch (e) {
      setPhase('idle');
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone permission was blocked. Allow it in the browser address bar and try again.'
          : e instanceof Error
            ? e.message
            : String(e),
      );
    }
  }, []);

  const stop = useCallback(async () => {
    clear();
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    setPhase('saving');
    const out = await r.stop();
    setLevel(0);
    setPhase('idle');
    if (out.durationSec < 2) {
      setError('That was under 2 seconds — try again.');
      return;
    }
    onDone(out);
  }, [onDone]);

  const start = useCallback(() => {
    if (disabled) return;
    if (prepSec > 0) {
      setPrepLeft(prepSec);
      setPhase('prep');
      const t0 = performance.now();
      timer.current = window.setInterval(() => {
        const left = prepSec - (performance.now() - t0) / 1000;
        setPrepLeft(left);
        if (left <= 0) beginRecording();
      }, 200);
    } else beginRecording();
  }, [disabled, prepSec, beginRecording]);

  const cancel = async () => {
    clear();
    await rec.current?.cancel();
    rec.current = null;
    setLevel(0);
    setPhase('idle');
  };

  // hard stop so a take can't run forever
  useEffect(() => {
    if (phase === 'rec' && elapsed >= hardStop) stop();
  }, [phase, elapsed, hardStop, stop]);

  // space bar: start / stop (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== 'Space' || e.repeat || /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable) return;
      e.preventDefault();
      if (el.tagName === 'BUTTON') el.blur();
      if (phase === 'idle') start();
      else if (phase === 'prep') beginRecording();
      else if (phase === 'rec') stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, start, stop, beginRecording]);

  // cleanup on unmount
  useEffect(
    () => () => {
      clear();
      rec.current?.cancel();
    },
    [],
  );

  const pct = Math.min(1, elapsed / targetSec);
  const over = phase === 'rec' && elapsed >= targetSec;
  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div className="recorder">
      <div className={`rec-dial ${phase} ${over ? 'over' : ''}`}>
        <svg viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r={R} className="ring-bg" />
          {phase === 'rec' && (
            <circle
              cx="60"
              cy="60"
              r={R}
              className="ring-fg"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              transform="rotate(-90 60 60)"
            />
          )}
        </svg>
        {phase === 'idle' && (
          <button className="rec-btn" onClick={start} disabled={disabled} aria-label="Start recording">
            <span className="dot" />
          </button>
        )}
        {phase === 'prep' && (
          <button className="rec-btn prep" onClick={beginRecording} aria-label="Start speaking now">
            <span className="big">{Math.ceil(prepLeft)}</span>
            <span className="small">think</span>
          </button>
        )}
        {phase === 'rec' && (
          <button className="rec-btn live" onClick={stop} aria-label="Stop recording">
            <span className="square" style={{ transform: `scale(${1 + level * 0.35})` }} />
          </button>
        )}
        {phase === 'saving' && <div className="rec-btn saving">…</div>}
      </div>

      <div className="rec-meta">
        {phase === 'idle' && (
          <>
            <div className="rec-title">{hint ?? 'Tap to speak'}</div>
            <div className="muted">
              Target {fmt(targetSec)}
              {prepSec > 0 && ` · ${prepSec}s to think first`} · <kbd>Space</kbd> to start/stop
            </div>
          </>
        )}
        {phase === 'prep' && (
          <>
            <div className="rec-title">Plan your first sentence and your ending.</div>
            <div className="muted">Recording starts automatically — or tap to start now.</div>
          </>
        )}
        {phase === 'rec' && (
          <>
            <div className={`rec-time ${over ? 'warn' : ''}`}>
              {fmt(elapsed)} <span className="muted">/ {fmt(targetSec)}</span>
            </div>
            <div className="muted">{over ? 'Time — land your final sentence.' : 'Recording… tap the square to finish.'}</div>
            <button className="link" onClick={cancel}>
              Discard
            </button>
          </>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
