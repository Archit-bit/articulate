import Sparkline from '../components/Sparkline';
import { useEngine } from '../lib/engine';
import { getPhrases, stats, useStoreVersion } from '../lib/store';
import type { DrillKind } from '../lib/types';

const TIPS: Record<string, string> = {
  clarity: 'Say your main point in the first sentence. Test: if they remembered only one line, which one would it be?',
  structure: 'Give your answer a skeleton before you speak: Point → Reason → Example → Point. Say “Two reasons…” before giving them.',
  concision: 'Cut the warm-up (“So basically what I wanted to say is…”). When the point is made, stop — don’t restate it.',
  confidence: 'Swap “I think maybe we could” for “I recommend”. Pause instead of filling silence. End sentences on a downward tone.',
  language: 'Replace vague words (thing, stuff, very, basically) with specific ones. Review your phrasebank daily.',
};

const LABEL: Record<DrillKind, string> = {
  rephrase: 'Rephrase',
  impromptu: 'Impromptu',
  explain: 'Explain & compress',
  roleplay: 'Client roleplay',
};

export default function Home({ go }: { go: (r: string) => void }) {
  useStoreVersion();
  const st = stats();
  const { engine, ready, checking } = useEngine();
  const phrases = getPhrases().filter((p) => !p.mastered).slice(0, 3);
  const deep: DrillKind = new Date().getDate() % 2 === 0 ? 'roleplay' : 'explain';

  const workout: { kind: DrillKind; mins: string; why: string }[] = [
    { kind: 'rephrase', mins: '3 min', why: 'Warm up your word choice: one sentence, three registers.' },
    { kind: 'impromptu', mins: '5 min', why: 'Two topics, each with one retry. Find the point, give it a structure.' },
    {
      kind: deep,
      mins: '7–10 min',
      why:
        deep === 'roleplay'
          ? 'A live client conversation with objections, then a debrief.'
          : 'Explain one thing in 2:00 → 1:00 → 0:20.',
    },
  ];

  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const recent = st.attempts.slice(-20);

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>{greet}.</h1>
        <p className="muted">Fifteen focused minutes a day beats a two-hour workshop once a month.</p>
      </header>

      {!ready && !checking && engine === 'server' && (
        <div className="card setup-card">
          <h3>Almost there</h3>
          <p>This app runs on your Google Cloud server. Enter the team passcode once in Settings and you’re set.</p>
          <button className="primary" onClick={() => go('settings')}>
            Open Settings
          </button>
        </div>
      )}
      {!ready && !checking && engine === 'gemini' && (
        <div className="card setup-card">
          <h3>One-time setup (2 minutes)</h3>
          <ol>
            <li>
              Open{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                aistudio.google.com/apikey
              </a>{' '}
              and create a free API key.
            </li>
            <li>Paste it in Settings. It stays in this browser only.</li>
            <li>Allow microphone access when Chrome asks.</li>
          </ol>
          <button className="primary" onClick={() => go('settings')}>
            Open Settings
          </button>
        </div>
      )}

      <div className="stat-row">
        <div className="stat">
          <b>{st.streak}</b>
          <span>day streak</span>
        </div>
        <div className="stat">
          <b>{st.thisWeek}</b>
          <span>sessions this week</span>
        </div>
        <div className="stat">
          <b>{st.practiceDays}</b>
          <span>days practised</span>
        </div>
        <div className="stat">
          <b>{getPhrases().length}</b>
          <span>phrases collected</span>
        </div>
      </div>

      <h2>Today’s workout</h2>
      <div className="workout">
        {workout.map((w, i) => {
          const done = st.doneToday.has(w.kind);
          return (
            <button key={w.kind} className={`workout-item ${done ? 'done' : ''}`} onClick={() => go(w.kind)}>
              <span className="num">{done ? '✓' : i + 1}</span>
              <span className="w-body">
                <b>{LABEL[w.kind]}</b> <span className="muted small">· {w.mins}</span>
                <span className="muted small block">{w.why}</span>
              </span>
              <span className="go">→</span>
            </button>
          );
        })}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Your focus right now</h3>
          {st.weakest ? (
            <>
              <p>
                Weakest area over your last {Math.min(12, st.attempts.length)} attempts: <b className="cap">{st.weakest}</b> (
                {st.avg[st.weakest].toFixed(1)}/10)
              </p>
              <p className="muted">{TIPS[st.weakest]}</p>
            </>
          ) : (
            <p className="muted">Do a few drills and your coach will spot your patterns here.</p>
          )}
          {st.fixes.length > 0 && (
            <>
              <h4>Latest instructions from your coach</h4>
              <ul className="plain">
                {st.fixes.map((f, i) => (
                  <li key={i}>{f.text}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card">
          <h3>Trend</h3>
          <div className="sparks">
            <Sparkline label="Overall" values={recent.map((a) => a.feedback.overall)} min={1} max={10} suffix="/10" />
            <Sparkline label="Fillers / min" values={recent.map((a) => a.metrics.fillersPerMin)} min={0} better="down" />
            <Sparkline label="Structure" values={recent.map((a) => a.feedback.scores.structure)} min={1} max={10} />
            <Sparkline label="Confidence" values={recent.map((a) => a.feedback.scores.confidence)} min={1} max={10} />
          </div>
        </div>
      </div>

      {phrases.length > 0 && (
        <div className="card">
          <div className="row">
            <h3>From your phrasebank</h3>
            <span className="grow" />
            <button className="link" onClick={() => go('phrasebank')}>
              Practise all →
            </button>
          </div>
          <ul className="swaps">
            {phrases.map((p) => (
              <li key={p.id}>
                <span className="said">{p.said}</span>
                <span className="arrow">→</span>
                <span className="better">{p.better}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
