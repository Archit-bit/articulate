import { useState } from 'react';
import AttemptPanel from '../components/AttemptPanel';
import { REPHRASE_SEEDS, REPHRASE_STYLES, pick } from '../lib/content';
import { freshPrompt, friendlyError, isTemporary } from '../lib/gemini';
import { getSettings, uid, upsertSession } from '../lib/store';
import type { Take } from '../lib/useAnalyze';

export default function Rephrase() {
  const [seed, setSeed] = useState(() => pick(REPHRASE_SEEDS));
  const [style, setStyle] = useState(0);
  const [byStyle, setByStyle] = useState<Take[][]>([[], [], []]);
  const [sid, setSid] = useState(uid);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  function newSeed(s: { text: string; context: string }) {
    setSeed(s);
    setStyle(0);
    setByStyle([[], [], []]);
    setSid(uid());
    setErr('');
    setNote('');
  }

  async function fresh() {
    setLoading(true);
    setErr('');
    setNote('');
    try {
      const r = await freshPrompt(getSettings(), 'rephrase');
      if (r?.text) newSeed({ text: r.text, context: r.context ?? 'At work' });
    } catch (e) {
      if (isTemporary(e)) {
        // AI topics are a nice-to-have: when Google is busy, quietly use one from the built-in list
        newSeed(pick(REPHRASE_SEEDS, seed));
        setNote('Google’s AI is busy right now, so here’s one from the built-in list.');
      } else setErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  const st = REPHRASE_STYLES[style];

  function onTake(t: Take) {
    const next = byStyle.map((r, i) => (i === style ? [...r, t] : r));
    setByStyle(next);
    upsertSession({
      id: sid,
      kind: 'rephrase',
      at: next.flat()[0]?.attempt.at ?? Date.now(),
      title: seed.text,
      attempts: next.flatMap((r) => r.map((x) => x.attempt)),
    });
  }

  const focus = `Rephrase drill. The blunt original message is: "${seed.text}" (context: ${seed.context}).
They were asked to say it in the "${st.name}" style: ${st.brief}
Judge especially: Did they keep the full meaning (nothing important dropped or softened into vagueness)? Did they hit the register of this style? Word choice and phrasing precision matter most here — be generous with wordSwaps.
In strongerVersion give the ideal spoken version in this style (1–3 sentences).`;

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Rephrase & word choice</h1>
        <p className="muted">
          Same message, three registers. This builds range: the ability to pick the right words for the room, instead of the
          first words that come.
        </p>
      </header>

      <div className="card prompt-card">
        <div className="eyebrow">{seed.context} — the blunt version</div>
        <div className="prompt-text">“{seed.text}”</div>
        <div className="row wrap">
          <button onClick={() => newSeed(pick(REPHRASE_SEEDS, seed))}>Another one</button>
          <button onClick={fresh} disabled={loading}>
            {loading ? 'Thinking…' : 'AI situation for me'}
          </button>
        </div>
        {note && <div className="muted small" style={{ marginTop: '0.6rem' }}>{note}</div>}
        {err && <div className="error">{err}</div>}
      </div>

      <div className="stepper">
        {REPHRASE_STYLES.map((s, i) => (
          <button
            key={s.id}
            className={`step ${i === style ? 'active' : ''} ${byStyle[i].length ? 'done' : ''}`}
            onClick={() => setStyle(i)}
          >
            {i + 1}. {s.name}
          </button>
        ))}
      </div>
      <p className="style-brief">
        <b>{st.name}:</b> {st.brief}
      </p>

      <AttemptPanel
        key={`${sid}-${style}`}
        opts={{
          kind: 'rephrase',
          prompt: seed.text,
          label: st.name,
          task: `Rephrase "${seed.text}" (${seed.context}) in a ${st.name} style.`,
          focus,
          targetSec: 30,
        }}
        prepSec={10}
        takes={byStyle[style]}
        onTake={onTake}
        actions={
          style < 2 ? (
            <button onClick={() => setStyle(style + 1)}>Next style: {REPHRASE_STYLES[style + 1].name} →</button>
          ) : (
            <button onClick={() => newSeed(pick(REPHRASE_SEEDS, seed))}>New sentence →</button>
          )
        }
      />
    </div>
  );
}
