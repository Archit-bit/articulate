import type { LiveConnectConfig } from '@google/genai';
import { useEffect, useRef, useState } from 'react';
import Debrief, { TranscriptView } from '../components/Debrief';
import { fmt } from '../components/Recorder';
import { Mic, PcmPlayer, pcmToBase64 } from '../lib/audio';
import { DIFFICULTY, SCENARIOS, type Difficulty } from '../lib/content';
import { debriefRoleplay, friendlyError, personaPrompt, type RoleplaySetup } from '../lib/gemini';
import { openLive, type LiveHandle, type LiveMessage } from '../lib/live';
import { recordLive } from '../lib/pricing';
import { addPhrases, getSettings, uid, upsertSession } from '../lib/store';
import type { RoleplayDebrief, Turn } from '../lib/types';

type Phase = 'setup' | 'connecting' | 'live' | 'debriefing' | 'done';
const MAX_SEC = 14 * 60 + 30; // Live API audio sessions are capped at 15 min

export default function Roleplay() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [form, setForm] = useState(() => ({ ...SCENARIOS[0] }));
  const [difficulty, setDifficulty] = useState<Difficulty>('realistic');
  const [headphones, setHeadphones] = useState(false);

  const [phase, setPhase] = useState<Phase>('setup');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [clientSpeaking, setClientSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [debrief, setDebrief] = useState<RoleplayDebrief | null>(null);
  const [error, setError] = useState('');

  const sessionRef = useRef<LiveHandle | null>(null);
  const micRef = useRef<Mic | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const closingRef = useRef(false);
  const billedRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const startedAt = useRef(0);
  const sid = useRef(uid());
  const setupRef = useRef<RoleplaySetup | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const setup: RoleplaySetup = {
    persona: form.persona,
    situation: form.situation,
    goal: form.goal,
    concerns: form.concerns,
    difficultyText: DIFFICULTY[difficulty],
  };

  function chooseScenario(id: string) {
    const s = SCENARIOS.find((x) => x.id === id)!;
    setScenarioId(id);
    setForm({ ...s });
  }

  function appendTurn(role: Turn['role'], text: string) {
    const t = turnsRef.current;
    const last = t.at(-1);
    if (last && last.role === role) last.text += text;
    else t.push({ role, text });
    setTurns(t.map((x) => ({ ...x })));
  }

  function onMessage(m: LiveMessage) {
    const sc = m.serverContent;
    if (m.goAway) setError('The session is about to hit its time limit — wrap up.');
    if (!sc) return;
    if (sc.interrupted) playerRef.current?.interrupt();
    for (const p of sc.modelTurn?.parts ?? []) {
      const d = p.inlineData;
      if (d?.data && (d.mimeType ?? 'audio').startsWith('audio')) {
        const rate = Number(/rate=(\d+)/.exec(d.mimeType ?? '')?.[1]) || 24000;
        playerRef.current?.play(d.data, rate);
      }
    }
    if (sc.inputTranscription?.text) appendTurn('you', sc.inputTranscription.text);
    if (sc.outputTranscription?.text) appendTurn('client', sc.outputTranscription.text);
  }

  async function teardown() {
    window.clearInterval(timerRef.current);
    // bill the call once, whether it ended normally, was aborted, or dropped
    if (sessionRef.current && startedAt.current && !billedRef.current) {
      billedRef.current = true;
      recordLive(getSettings().liveModel, (Date.now() - startedAt.current) / 1000, playerRef.current?.receivedSec ?? 0);
    }
    await micRef.current?.stop().catch(() => {});
    micRef.current = null;
    try {
      sessionRef.current?.close();
    } catch {
      /* ignore */
    }
    sessionRef.current = null;
    await playerRef.current?.close().catch(() => {});
    playerRef.current = null;
    setLevel(0);
    setClientSpeaking(false);
  }

  async function start() {
    const s = getSettings();
    setError('');
    setDebrief(null);
    turnsRef.current = [];
    setTurns([]);
    setElapsed(0);
    closingRef.current = false;
    billedRef.current = false;
    startedAt.current = 0;
    sid.current = uid();
    setupRef.current = setup;
    setPhase('connecting');
    try {
      const player = new PcmPlayer();
      await player.resume();
      playerRef.current = player;

      const config: LiveConnectConfig = {
        systemInstruction: personaPrompt(setup, s.aboutMe),
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      };
      if (s.voice) config.speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } } };

      const session = await openLive(s, config, {
        onmessage: onMessage,
        onerror: (msg) => setError(msg),
        onclose: (reason) => {
          if (closingRef.current) return;
          setError(reason ? `Connection closed: ${friendlyError(reason)}` : 'The connection closed.');
          finish();
        },
      });
      sessionRef.current = session;

      const mic = new Mic();
      mic.onLevel = setLevel;
      mic.onChunk = (pcm) => {
        // Without headphones, the laptop mic hears the client's voice — so pause the mic while they talk.
        if (!headphones && playerRef.current?.speaking) return;
        sessionRef.current?.sendAudio(pcmToBase64(pcm));
      };
      await mic.start();
      micRef.current = mic;

      // The client opens the meeting.
      session.sendText('(The meeting starts now. Open it in character.)');

      startedAt.current = Date.now();
      timerRef.current = window.setInterval(() => {
        const sec = (Date.now() - startedAt.current) / 1000;
        setElapsed(sec);
        setClientSpeaking(!!playerRef.current?.speaking);
        if (sec >= MAX_SEC) finish();
      }, 250);
      setPhase('live');
    } catch (e) {
      await teardown();
      setPhase('setup');
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone permission was blocked. Allow it in the address bar and try again.'
          : friendlyError(e),
      );
    }
  }

  async function finish() {
    if (closingRef.current) return;
    closingRef.current = true;
    const dur = (Date.now() - startedAt.current) / 1000;
    await teardown();
    const t = turnsRef.current
      .map((x) => ({ ...x, text: x.text.replace(/\s+/g, ' ').trim() }))
      .filter((x) => x.text);
    turnsRef.current = t;
    setTurns(t);
    if (!t.some((x) => x.role === 'you')) {
      setPhase('setup');
      setError((prev) => prev || 'Nothing was captured from your side, so there is nothing to debrief.');
      return;
    }
    await runDebrief(t, dur);
  }

  async function runDebrief(t: Turn[], dur: number) {
    setPhase('debriefing');
    const title = SCENARIOS.find((x) => x.id === scenarioId)?.title ?? 'Roleplay';
    const base = {
      id: sid.current,
      kind: 'roleplay' as const,
      at: startedAt.current || Date.now(),
      title: `${title} (${difficulty})`,
      transcript: t,
      durationSec: Math.round(dur),
    };
    upsertSession(base);
    try {
      const d = await debriefRoleplay(getSettings(), setupRef.current ?? setup, t, dur);
      setDebrief(d);
      addPhrases(d.wordSwaps, 'roleplay');
      upsertSession({ ...base, debrief: d });
    } catch (e) {
      setError(friendlyError(e));
    }
    setPhase('done');
  }

  async function abort() {
    closingRef.current = true;
    await teardown();
    setPhase('setup');
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  useEffect(
    () => () => {
      closingRef.current = true;
      teardown();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ---------------------------------------------------------------- render

  if (phase === 'connecting' || phase === 'live') {
    const warn = elapsed > MAX_SEC - 60;
    return (
      <div className="screen live">
        <header className="live-head">
          <div>
            <div className="eyebrow">Live · {SCENARIOS.find((x) => x.id === scenarioId)?.title} · {difficulty}</div>
            <div className={`live-status ${clientSpeaking ? 'client' : 'you'}`}>
              {phase === 'connecting' ? 'Connecting…' : clientSpeaking ? 'Client is speaking' : 'Your turn — speak naturally'}
            </div>
          </div>
          <div className={`live-timer ${warn ? 'warn' : ''}`}>{fmt(elapsed)}</div>
        </header>
        <div className="level">
          <span style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
        <div className="card convo-card" ref={scrollRef}>
          {turns.length === 0 ? (
            <p className="muted">Waiting for the client to open the meeting…</p>
          ) : (
            <TranscriptView turns={turns} />
          )}
        </div>
        <div className="goal-strip">
          <b>Your goal:</b> {form.goal || '—'}
        </div>
        {error && <div className="error">{error}</div>}
        <div className="actions">
          <button className="primary" onClick={finish} disabled={phase !== 'live'}>
            End meeting & get debrief
          </button>
          <button onClick={abort}>Abort</button>
        </div>
      </div>
    );
  }

  if (phase === 'debriefing') {
    return (
      <div className="screen">
        <div className="card analyzing">
          <div className="spinner" />
          <div>
            <b>Writing your debrief…</b>
            <div className="muted small">Finding the moments that mattered.</div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="screen">
        <header className="screen-head">
          <h1>Meeting debrief</h1>
          <p className="muted">
            {SCENARIOS.find((x) => x.id === scenarioId)?.title} · {difficulty} · {fmt(elapsed)}
          </p>
        </header>
        {error && (
          <div className="error">
            {error}{' '}
            <button className="link" onClick={() => runDebrief(turnsRef.current, elapsed)}>
              Try the debrief again
            </button>
          </div>
        )}
        <div className="card">
          {debrief ? <Debrief d={debrief} turns={turns} /> : <TranscriptView turns={turns} />}
        </div>
        <div className="actions">
          <button className="primary" onClick={start}>
            Run it again
          </button>
          <button onClick={() => setPhase('setup')}>Change scenario</button>
        </div>
      </div>
    );
  }

  // setup
  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Client meeting roleplay</h1>
        <p className="muted">
          A live voice conversation with a realistic client who pushes back. Then a debrief on the moments that mattered.
        </p>
      </header>

      <div className="scenario-grid">
        {SCENARIOS.map((s) => (
          <button key={s.id} className={`scenario ${scenarioId === s.id ? 'on' : ''}`} onClick={() => chooseScenario(s.id)}>
            <b>{s.title}</b>
            <span className="muted small">{s.blurb}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <label className="field">
          Who is the client?
          <textarea rows={2} value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} />
        </label>
        <label className="field">
          Situation
          <textarea rows={2} value={form.situation} onChange={(e) => setForm({ ...form, situation: e.target.value })} />
        </label>
        <label className="field">
          Your goal for this meeting
          <input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
        </label>
        <label className="field">
          What they will push on
          <textarea rows={2} value={form.concerns} onChange={(e) => setForm({ ...form, concerns: e.target.value })} />
        </label>

        <div className="row wrap">
          <div className="segmented">
            {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
              <button key={d} className={difficulty === d ? 'on' : ''} onClick={() => setDifficulty(d)}>
                {d}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={headphones} onChange={(e) => setHeadphones(e.target.checked)} />
            I’m wearing headphones <span className="muted small">(lets you interrupt the client)</span>
          </label>
        </div>

        {error && <div className="error">{error}</div>}
        <div className="actions">
          <button className="primary" onClick={start} disabled={!form.persona.trim() || !form.goal.trim()}>
            Start the meeting
          </button>
          <span className="muted small">
            Up to 15 min. Tip: before you start, say your goal to yourself in one sentence.
          </span>
        </div>
      </div>
    </div>
  );
}
