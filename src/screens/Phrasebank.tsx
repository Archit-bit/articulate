import { useState } from 'react';
import { deletePhrase, getPhrases, updatePhrase, useStoreVersion } from '../lib/store';

export default function Phrasebank() {
  useStoreVersion();
  const all = getPhrases();
  const [mode, setMode] = useState<'list' | 'cards'>('list');
  const [showMastered, setShowMastered] = useState(false);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const list = all.filter((p) => showMastered || !p.mastered);
  const deck = all.filter((p) => !p.mastered);
  const card = deck.length ? deck[idx % deck.length] : null;

  function next() {
    setRevealed(false);
    setIdx((i) => i + 1);
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Phrasebank</h1>
        <p className="muted">
          Every word swap your coach suggests lands here — your own vocabulary, taken from how you actually speak. Say the
          better version out loud until it comes to you first.
        </p>
      </header>

      <div className="row">
        <div className="segmented">
          <button className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>
            List ({list.length})
          </button>
          <button className={mode === 'cards' ? 'on' : ''} onClick={() => (setMode('cards'), setRevealed(false))}>
            Practise ({deck.length})
          </button>
        </div>
        <span className="grow" />
        {mode === 'list' && (
          <label className="check">
            <input type="checkbox" checked={showMastered} onChange={(e) => setShowMastered(e.target.checked)} /> Show mastered
          </label>
        )}
      </div>

      {mode === 'cards' ? (
        card ? (
          <div className="card flash">
            <div className="eyebrow">You said</div>
            <div className="prompt-text">“{card.said}”</div>
            {!revealed ? (
              <>
                <p className="muted">Say a sharper version out loud. Then reveal.</p>
                <button className="primary" onClick={() => setRevealed(true)}>
                  Reveal
                </button>
              </>
            ) : (
              <>
                <div className="eyebrow">Sharper</div>
                <div className="prompt-text better">“{card.better}”</div>
                <p className="muted">{card.why}</p>
                <p className="small">Now say it out loud in a full sentence of your own.</p>
                <div className="actions">
                  <button className="primary" onClick={() => (updatePhrase(card.id, { mastered: true }), setRevealed(false))}>
                    I’ve got it
                  </button>
                  <button onClick={next}>Again later</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="card muted">Nothing to practise yet — do a drill and swaps will appear here.</div>
        )
      ) : list.length === 0 ? (
        <div className="card muted">No phrases yet. Your coach adds them after each drill.</div>
      ) : (
        <div className="card">
          <ul className="swaps big">
            {list.map((p) => (
              <li key={p.id} className={p.mastered ? 'mastered' : ''}>
                <div>
                  <span className="said">{p.said}</span>
                  <span className="arrow">→</span>
                  <span className="better">{p.better}</span>
                </div>
                <div className="muted small">
                  {p.why} · {p.source} · {new Date(p.at).toLocaleDateString()}
                </div>
                <div className="row-actions">
                  <button className="link" onClick={() => updatePhrase(p.id, { mastered: !p.mastered })}>
                    {p.mastered ? 'Unmark' : 'Mark mastered'}
                  </button>
                  <button className="link danger" onClick={() => deletePhrase(p.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
