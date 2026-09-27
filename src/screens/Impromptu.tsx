import { useState } from 'react';
import AttemptPanel from '../components/AttemptPanel';
import { TOPICS, pick, type TopicCategory } from '../lib/content';
import { freshPrompt, friendlyError, isTemporary } from '../lib/gemini';
import { getSettings, uid, upsertSession } from '../lib/store';
import type { Take } from '../lib/useAnalyze';

const CATS: (TopicCategory | 'All')[] = ['All', 'Business', 'On the spot', 'Opinion', 'Story', 'Explain'];

const FOCUS = `Impromptu speaking — thinking on your feet. Judge especially:
(1) Did they state a clear point or answer within the first ~10 seconds?
(2) Did they use a recognisable structure (e.g. Point–Reason–Example–Point, Past–Present–Future, Problem–Solution, "two reasons")?
(3) Did they land a clear closing line instead of trailing off or repeating?
(4) Did they stay on the question?
If they lacked a structure, name a specific one in fixNext and show it in strongerVersion.`;

export default function Impromptu() {
  const [cat, setCat] = useState<TopicCategory | 'All'>('All');
  const [topic, setTopic] = useState(() => pick(TOPICS).text);
  const [prep, setPrep] = useState(15);
  const [target, setTarget] = useState(90);
  const [takes, setTakes] = useState<Take[]>([]);
  const [sid, setSid] = useState(uid);
  const [custom, setCustom] = useState('');
  const [loadingFresh, setLoadingFresh] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  function newTopic(text: string) {
    setTopic(text);
    setTakes([]);
    setSid(uid());
    setErr('');
    setNote('');
  }

  function shuffle() {
    const pool = TOPICS.filter((t) => cat === 'All' || t.cat === cat).map((t) => t.text);
    newTopic(pick(pool, topic));
  }

  function pickCategory(c: TopicCategory | 'All') {
    setCat(c);
    const pool = TOPICS.filter((t) => c === 'All' || t.cat === c).map((t) => t.text);
    newTopic(pick(pool, topic));
  }

  async function fresh() {
    setLoadingFresh(true);
    setErr('');
    setNote('');
    try {
      const r = await freshPrompt(getSettings(), 'impromptu');
      if (r?.text) newTopic(r.text);
    } catch (e) {
      if (isTemporary(e)) {
        // AI topics are a nice-to-have: when Google is busy, quietly use one from the built-in list
        newTopic(pick(TOPICS.filter((t) => cat === 'All' || t.cat === cat).map((t) => t.text), topic));
        setNote('Google’s AI is busy right now, so here’s one from the built-in list.');
      } else setErr(friendlyError(e));
    } finally {
      setLoadingFresh(false);
    }
  }

  function onTake(t: Take) {
    const next = [...takes, t];
    setTakes(next);
    upsertSession({
      id: sid,
      kind: 'impromptu',
      at: next[0].attempt.at,
      title: topic,
      attempts: next.map((x) => x.attempt),
    });
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Impromptu speaking</h1>
        <p className="muted">
          One prompt, no preparation beyond a few seconds. You are training the muscle of finding a point and a structure on the spot.
        </p>
      </header>

      <div className="card prompt-card">
        <div className="eyebrow">Your topic</div>
        <div className="prompt-text">{topic}</div>
        <div className="row wrap">
          <div className="chips">
            {CATS.map((c) => (
              <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => pickCategory(c)}>
                {c}
              </button>
            ))}
          </div>
          <span className="grow" />
          <button onClick={shuffle}>Shuffle</button>
          <button onClick={fresh} disabled={loadingFresh}>
            {loadingFresh ? 'Thinking…' : 'AI topic for me'}
          </button>
        </div>
        <div className="row wrap">
          <input
            placeholder="…or type your own topic / a question you expect in a meeting"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && custom.trim() && (newTopic(custom.trim()), setCustom(''))}
          />
          <button disabled={!custom.trim()} onClick={() => (newTopic(custom.trim()), setCustom(''))}>
            Use
          </button>
        </div>
        <div className="row wrap settings-row">
          <label>
            Think time
            <select value={prep} onChange={(e) => setPrep(+e.target.value)}>
              <option value={0}>None</option>
              <option value={5}>5 s</option>
              <option value={15}>15 s</option>
              <option value={30}>30 s</option>
            </select>
          </label>
          <label>
            Speak for
            <select value={target} onChange={(e) => setTarget(+e.target.value)}>
              <option value={45}>45 s</option>
              <option value={60}>1 min</option>
              <option value={90}>1.5 min</option>
              <option value={120}>2 min</option>
            </select>
          </label>
          <span className="muted small">Structure that always works: Point → Reason → Example → Point.</span>
        </div>
        {note && <div className="muted small" style={{ marginTop: '0.6rem' }}>{note}</div>}
        {err && <div className="error">{err}</div>}
      </div>

      <AttemptPanel
        key={sid}
        opts={{ kind: 'impromptu', prompt: topic, task: `Speak impromptu on: "${topic}"`, focus: FOCUS, targetSec: target }}
        prepSec={prep}
        takes={takes}
        onTake={onTake}
        actions={<button onClick={shuffle}>Next topic</button>}
      />
    </div>
  );
}
