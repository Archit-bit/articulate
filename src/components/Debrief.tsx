import type { RoleplayDebrief, Turn } from '../lib/types';
import { Callout, Overall, ScoreBars, Swaps } from './Scorecard';

export function TranscriptView({ turns }: { turns: Turn[] }) {
  return (
    <div className="convo">
      {turns.map((t, i) => (
        <div key={i} className={`bubble ${t.role}`}>
          <span className="who">{t.role === 'you' ? 'You' : 'Client'}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export default function Debrief({ d, turns }: { d: RoleplayDebrief; turns?: Turn[] }) {
  return (
    <div className="scorecard">
      <Overall value={d.overall} verdict={d.verdict} />
      <Callout title="Where the meeting ended up" kind="info">
        {d.outcome}
      </Callout>
      <Callout title="Fix this in your next meeting">{d.fixNext}</Callout>

      <div className="grid-2">
        <section>
          <h4>Scores</h4>
          <ScoreBars
            items={[
              ['Clarity', d.scores.clarity],
              ['Structure', d.scores.structure],
              ['Listening', d.scores.listening],
              ['Objections', d.scores.objectionHandling],
              ['Confidence', d.scores.confidence],
            ]}
          />
        </section>
        <section>
          {d.strengths.length > 0 && (
            <>
              <h4>What worked</h4>
              <ul className="plain">
                {d.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {d.moments.length > 0 && (
        <section>
          <h4>Moments that mattered</h4>
          <ol className="moments">
            {d.moments.map((m, i) => (
              <li key={i}>
                <div className="m-client">
                  <span className="who">Client</span> {m.clientSaid}
                </div>
                <div className="m-you">
                  <span className="who">You said</span> {m.youSaid}
                </div>
                <div className="m-better">
                  <span className="who">Stronger</span> {m.better}
                </div>
                <div className="muted small">{m.why}</div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Swaps swaps={d.wordSwaps} />

      {turns && turns.length > 0 && (
        <details className="transcript">
          <summary>Full transcript</summary>
          <TranscriptView turns={turns} />
        </details>
      )}
    </div>
  );
}
