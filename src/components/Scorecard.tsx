import type { ReactNode } from 'react';
import type { Attempt, WordSwap } from '../lib/types';
import { fmt } from './Recorder';

export function ScoreBars({ items }: { items: [string, number][] }) {
  return (
    <div className="bars">
      {items.map(([label, v]) => (
        <div className="bar-row" key={label}>
          <span className="bar-label">{label}</span>
          <span className="bar-track">
            <span className={`bar-fill ${tone(v)}`} style={{ width: `${Math.max(0, Math.min(10, v)) * 10}%` }} />
          </span>
          <span className="bar-val">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function tone(v: number) {
  return v >= 8 ? 'good' : v >= 6 ? 'ok' : 'low';
}

export function Overall({ value, verdict }: { value: number; verdict: string }) {
  return (
    <div className="overall">
      <div className={`overall-num ${tone(value)}`}>
        {value}
        <span>/10</span>
      </div>
      <p className="verdict">{verdict}</p>
    </div>
  );
}

export function Callout({ title, children, kind = 'focus' }: { title: string; children: ReactNode; kind?: 'focus' | 'info' }) {
  return (
    <div className={`callout ${kind}`}>
      <div className="callout-title">{title}</div>
      <div>{children}</div>
    </div>
  );
}

export function Swaps({ swaps }: { swaps: WordSwap[] }) {
  if (!swaps.length) return null;
  return (
    <section>
      <h4>Word swaps <span className="muted small">· saved to your phrasebank</span></h4>
      <ul className="swaps">
        {swaps.map((s, i) => (
          <li key={i}>
            <span className="said">{s.said}</span>
            <span className="arrow">→</span>
            <span className="better">{s.better}</span>
            <div className="muted small">{s.why}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function highlightFillers(text: string, words: string[]) {
  const clean = words.map((w) => w.trim()).filter(Boolean);
  if (!clean.length) return text;
  const re = new RegExp(
    `\\b(${clean.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'gi',
  );
  const parts = text.split(re);
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p));
}

function paceLabel(wpm: number) {
  if (wpm < 105) return 'slow';
  if (wpm > 175) return 'fast';
  return 'good';
}

export default function Scorecard({ attempt, audioUrl }: { attempt: Attempt; audioUrl?: string }) {
  const { feedback: fb, metrics: m, targetSec } = attempt;
  const lengthOk = m.durationSec <= targetSec + 10 && m.durationSec >= targetSec * 0.5;
  return (
    <div className="scorecard">
      <Overall value={fb.overall} verdict={fb.verdict} />

      <div className="metrics">
        <div className={`metric ${lengthOk ? '' : 'flag'}`}>
          <b>{fmt(m.durationSec)}</b>
          <span>length · target {fmt(targetSec)}</span>
        </div>
        <div className={`metric ${paceLabel(m.wpm) === 'good' ? '' : 'flag'}`}>
          <b>{m.wpm}</b>
          <span>words/min · {paceLabel(m.wpm)}</span>
        </div>
        <div className={`metric ${m.fillersPerMin > 4 ? 'flag' : ''}`}>
          <b>{m.fillerCount}</b>
          <span>fillers · {m.fillersPerMin}/min</span>
        </div>
      </div>

      {fb.vsPrevious && (
        <Callout title="Compared with your last attempt" kind="info">
          {fb.vsPrevious}
        </Callout>
      )}

      <Callout title="Fix this on your next attempt">{fb.fixNext}</Callout>

      <div className="grid-2">
        <section>
          <h4>Scores</h4>
          <ScoreBars
            items={[
              ['Clarity', fb.scores.clarity],
              ['Structure', fb.scores.structure],
              ['Concision', fb.scores.concision],
              ['Confidence', fb.scores.confidence],
              ['Language', fb.scores.language],
            ]}
          />
          {fb.delivery && <p className="muted small delivery">{fb.delivery}</p>}
        </section>
        <section>
          {fb.strengths.length > 0 && (
            <>
              <h4>What worked</h4>
              <ul className="plain">
                {fb.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {fb.fillers.length > 0 && (
            <>
              <h4>Fillers heard</h4>
              <div className="chips">
                {fb.fillers.map((f) => (
                  <span className="chip" key={f.word}>
                    {f.word} × {f.count}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {fb.issues.length > 0 && (
        <section>
          <h4>What to fix</h4>
          <ol className="issues">
            {fb.issues.map((iss, i) => (
              <li key={i}>
                <q>{iss.quote}</q>
                <div>{iss.problem}</div>
                <div className="fix">→ {iss.fix}</div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Swaps swaps={fb.wordSwaps} />

      <section>
        <h4>A stronger version, in your words</h4>
        <blockquote className="stronger">{fb.strongerVersion}</blockquote>
        <p className="muted small">Read it aloud once — then retry without looking.</p>
      </section>

      <details className="transcript">
        <summary>Your transcript {audioUrl && '& recording'}</summary>
        {audioUrl && <audio controls src={audioUrl} />}
        <p>{highlightFillers(fb.transcript, fb.fillers.map((f) => f.word))}</p>
      </details>
    </div>
  );
}
