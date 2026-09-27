import { useState } from 'react';
import AttemptPanel from '../components/AttemptPanel';
import { fmt } from '../components/Recorder';
import { tone } from '../components/Scorecard';
import { EXPLAIN_PRESETS, EXPLAIN_ROUNDS } from '../lib/content';
import { uid, upsertSession } from '../lib/store';
import type { Take } from '../lib/useAnalyze';

export default function Explain() {
  const [what, setWhat] = useState('');
  const [audience, setAudience] = useState('');
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const [rounds, setRounds] = useState<Take[][]>([[], [], []]);
  const [sid, setSid] = useState(uid);
  const [finished, setFinished] = useState(false);

  function reset() {
    setStarted(false);
    setRound(0);
    setRounds([[], [], []]);
    setSid(uid());
    setFinished(false);
  }

  const target = EXPLAIN_ROUNDS[round];
  const bestOf = (r: Take[]) => r.at(-1);

  function focusFor(r: number) {
    const earlier = rounds
      .slice(0, r)
      .map((takes, i) => {
        const t = bestOf(takes);
        return t ? `Round ${i + 1} (${fmt(EXPLAIN_ROUNDS[i])}) transcript: """${t.attempt.feedback.transcript}"""` : '';
      })
      .filter(Boolean)
      .join('\n');
    return `Explain-and-compress drill, round ${r + 1} of 3 (limit ${fmt(EXPLAIN_ROUNDS[r])}).
Audience: ${audience || 'a smart non-expert'}.
Judge especially: Is the single most important message obvious to THIS audience? Any jargon they would not follow? Is there a concrete example or number? Does it end with a clear takeaway?
${r > 0 ? `This is a compression round. Compare with the earlier rounds below: did the core message survive? What essential thing was lost, or what filler was rightly cut? The strongerVersion must fit in ${EXPLAIN_ROUNDS[r]} seconds when spoken.\n${earlier}` : 'This is the long version — it is fine to include detail, but it must still have a clear spine.'}`;
  }

  function onTake(t: Take) {
    const next = rounds.map((r, i) => (i === round ? [...r, t] : r));
    setRounds(next);
    upsertSession({
      id: sid,
      kind: 'explain',
      at: next.flat()[0]?.attempt.at ?? Date.now(),
      title: `${what} → ${audience}`,
      attempts: next.flatMap((r) => r.map((x) => x.attempt)),
    });
  }

  if (!started) {
    return (
      <div className="screen">
        <header className="screen-head">
          <h1>Explain it — then compress it</h1>
          <p className="muted">
            Explain one thing in 2 minutes, then in 1 minute, then in 20 seconds. Each cut forces you to find what actually
            matters. This is the drill for client pitches.
          </p>
        </header>
        <div className="card">
          <div className="eyebrow">Pick one or write your own</div>
          <div className="preset-list">
            {EXPLAIN_PRESETS.map((p) => (
              <button
                key={p.what}
                className={`preset ${what === p.what ? 'on' : ''}`}
                onClick={() => (setWhat(p.what), setAudience(p.audience))}
              >
                <b>{p.what}</b>
                <span className="muted small">to {p.audience.toLowerCase()}</span>
              </button>
            ))}
          </div>
          <label className="field">
            What are you explaining?
            <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. Our document-automation product" />
          </label>
          <label className="field">
            To whom?
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. A hospital CFO who has 2 minutes"
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={!what.trim()} onClick={() => setStarted(true)}>
              Start round 1 · 2:00
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="screen">
        <header className="screen-head">
          <h1>Your compression ladder</h1>
          <p className="muted">
            {what} → {audience}
          </p>
        </header>
        <div className="ladder">
          {rounds.map((takes, i) => {
            const t = bestOf(takes);
            if (!t) return null;
            return (
              <div className="card" key={i}>
                <div className="row">
                  <span className="tag">{fmt(EXPLAIN_ROUNDS[i])}</span>
                  <span className={`score-pill ${tone(t.attempt.feedback.overall)}`}>{t.attempt.feedback.overall}/10</span>
                  <span className="muted small">
                    {t.attempt.metrics.durationSec}s · {t.attempt.metrics.fillerCount} fillers
                  </span>
                </div>
                <p>{t.attempt.feedback.transcript}</p>
              </div>
            );
          })}
        </div>
        {bestOf(rounds[2]) && (
          <div className="callout focus">
            <div className="callout-title">Your 20-second version — memorise this</div>
            <div>{bestOf(rounds[2])!.attempt.feedback.strongerVersion}</div>
          </div>
        )}
        <div className="actions">
          <button className="primary" onClick={reset}>
            New topic
          </button>
          <button onClick={() => (setFinished(false), setRound(0))}>Back to rounds</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>
          {what} <span className="muted">→ {audience || 'a smart non-expert'}</span>
        </h1>
        <div className="stepper">
          {EXPLAIN_ROUNDS.map((sec, i) => (
            <button
              key={i}
              className={`step ${i === round ? 'active' : ''} ${rounds[i].length ? 'done' : ''}`}
              onClick={() => (i === 0 || rounds[i - 1].length > 0) && setRound(i)}
            >
              Round {i + 1} · {fmt(sec)}
            </button>
          ))}
        </div>
      </header>

      <AttemptPanel
        key={`${sid}-${round}`}
        opts={{
          kind: 'explain',
          prompt: what,
          label: fmt(target),
          task: `Explain "${what}" to ${audience || 'a smart non-expert'} in at most ${fmt(target)}.`,
          focus: focusFor(round),
          targetSec: target,
        }}
        prepSec={round === 0 ? 15 : 10}
        takes={rounds[round]}
        onTake={onTake}
        actions={
          round < 2 ? (
            <button onClick={() => setRound(round + 1)}>Next round · {fmt(EXPLAIN_ROUNDS[round + 1])} →</button>
          ) : (
            <button onClick={() => setFinished(true)}>See the ladder →</button>
          )
        }
      />
      <button className="link" onClick={reset}>
        ← Change topic
      </button>
    </div>
  );
}
