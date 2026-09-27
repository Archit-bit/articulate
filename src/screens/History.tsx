import { useState } from 'react';
import Debrief from '../components/Debrief';
import Scorecard, { tone } from '../components/Scorecard';
import { deleteSession, getSessions, useStoreVersion } from '../lib/store';
import type { Session } from '../lib/types';

const KIND: Record<Session['kind'], string> = {
  impromptu: 'Impromptu',
  explain: 'Explain',
  rephrase: 'Rephrase',
  roleplay: 'Roleplay',
};

function score(s: Session) {
  if (s.debrief) return s.debrief.overall;
  const a = s.attempts?.at(-1);
  return a ? a.feedback.overall : null;
}

export default function History() {
  useStoreVersion();
  const sessions = getSessions();
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(0);

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>History</h1>
        <p className="muted">Every session, with the full feedback. Stored only in this browser.</p>
      </header>
      {sessions.length === 0 && <div className="card muted">No sessions yet.</div>}
      <div className="history">
        {sessions.map((s) => {
          const sc = score(s);
          const isOpen = open === s.id;
          return (
            <div className={`card history-item ${isOpen ? 'open' : ''}`} key={s.id}>
              <button className="history-row" onClick={() => (setOpen(isOpen ? null : s.id), setShown(0))}>
                <span className="tag">{KIND[s.kind]}</span>
                <span className="h-title">{s.title}</span>
                <span className="muted small">
                  {new Date(s.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  {s.attempts && s.attempts.length > 1 && ` · ${s.attempts.length} attempts`}
                </span>
                {sc !== null && <span className={`score-pill ${tone(sc)}`}>{sc}/10</span>}
              </button>
              {isOpen && (
                <div className="history-body">
                  {s.kind === 'roleplay' ? (
                    s.debrief ? (
                      <Debrief d={s.debrief} turns={s.transcript} />
                    ) : (
                      <p className="muted">No debrief was generated for this meeting.</p>
                    )
                  ) : (
                    s.attempts && (
                      <>
                        {s.attempts.length > 1 && (
                          <div className="tabs">
                            {s.attempts.map((a, i) => (
                              <button key={i} className={i === shown ? 'active' : ''} onClick={() => setShown(i)}>
                                {a.label ?? `Attempt ${i + 1}`} · {a.feedback.overall}/10
                              </button>
                            ))}
                          </div>
                        )}
                        <Scorecard attempt={s.attempts[Math.min(shown, s.attempts.length - 1)]} />
                      </>
                    )
                  )}
                  <button className="link danger" onClick={() => deleteSession(s.id)}>
                    Delete this session
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
