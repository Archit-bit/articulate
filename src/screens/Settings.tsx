import { useRef, useState } from 'react';
import UsageCard from '../components/UsageCard';
import { VOICES } from '../lib/content';
import { friendlyError, testKey } from '../lib/gemini';
import { useEngine } from '../lib/engine';
import { DEFAULT_SETTINGS, clearAll, exportAll, getSettings, importAll, saveSettings } from '../lib/store';

const COACH_MODELS = [
  ['gemini-3.8-flash', 'Gemini 3.8 Flash — best feedback (default)'],
  ['gemini-3.7-flash', 'Gemini 3.7 Flash — backup if 3.8 is busy'],
  ['gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite — faster, cheaper'],
  ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite — cheapest'],
];
const LIVE_MODELS = [
  ['gemini-3.8-live', 'Gemini 3.8 Live — fast, natural (default)'],
  ['gemini-3.8-live-extended-thinking', 'Gemini 3.8 Live Extended Thinking — sharper client, slower replies'],
];

export default function Settings() {
  const [s, setS] = useState(getSettings);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState('');
  const [statusOk, setStatusOk] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resets, setResets] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { engine, health } = useEngine();

  function update<K extends keyof typeof s>(k: K, v: (typeof s)[K]) {
    const next = { ...s, [k]: v };
    setS(next);
    saveSettings(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  async function test() {
    setStatus('Testing…');
    setStatusOk(false);
    try {
      const r = await testKey(s);
      setStatus(r.message);
      setStatusOk(r.ok);
    } catch (e) {
      setStatus(friendlyError(e));
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `articulate-backup-${new Date().toLocaleDateString('en-CA')}.json`;
    a.click();
  }

  async function upload(f: File) {
    try {
      importAll(JSON.parse(await f.text()));
      setStatus('Backup restored ✓');
    } catch {
      setStatus('That file is not a valid backup.');
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Settings {saved && <span className="saved">saved</span>}</h1>
      </header>

      <div className="card">
        <h3>AI engine</h3>
        <div className="segmented" style={{ marginBottom: '0.6rem' }}>
          {(
            [
              ['auto', 'Auto'],
              ['server', 'Google Cloud server'],
              ['gemini', 'Gemini API key'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={s.engine === id ? 'on' : ''} onClick={() => (update('engine', id), setStatus(''))}>
              {label}
            </button>
          ))}
        </div>
        <p className="small">
          {engine === 'server' ? (
            <>
              <b>Using: Google Cloud server</b> — AI runs on Vertex AI and is paid from your Google Cloud credits. No API key
              needed.{' '}
              {health?.reachable ? (
                health.passcodeValid ? (
                  <span className="good">Passcode accepted ✓</span>
                ) : (
                  <span className="low">Enter the team passcode.</span>
                )
              ) : (
                <span className="low">Server not reachable{s.serverUrl ? ' at that address' : ' from this page'}.</span>
              )}
            </>
          ) : (
            <>
              <b>Using: Gemini API key</b> — straight from this browser to Google AI Studio.
              {s.engine === 'auto' && ' (No Articulate server found at this address.)'}
            </>
          )}
        </p>

        {engine === 'server' && (
          <>
            <label className="field">
              Team passcode
              <div className="row">
                <input
                  type={show ? 'text' : 'password'}
                  value={s.passcode}
                  placeholder="The passcode chosen when the server was deployed"
                  onChange={(e) => update('passcode', e.target.value.trim())}
                  autoComplete="off"
                />
                <button onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
                <button className="primary" onClick={test} disabled={!s.passcode}>
                  Test
                </button>
              </div>
            </label>
            <label className="field">
              Server address <span className="muted small">— only if you opened the app from another link (e.g. Amplify)</span>
              <input
                value={s.serverUrl}
                placeholder="https://articulate-xxxxx.asia-south1.run.app"
                onChange={(e) => update('serverUrl', e.target.value.trim())}
              />
            </label>
          </>
        )}

        {engine === 'gemini' && (
          <>
            <p className="muted small">
              Key from{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                aistudio.google.com/apikey
              </a>
              . Stored only in this browser and sent only to Google. <b>Free tier privacy:</b> Google may use free-tier requests
              to improve its products — keep confidential client details out.
            </p>
            <div className="row">
              <input
                type={show ? 'text' : 'password'}
                value={s.apiKey}
                placeholder="Paste your Gemini API key"
                onChange={(e) => update('apiKey', e.target.value.trim())}
                autoComplete="off"
              />
              <button onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
              <button className="primary" onClick={test} disabled={!s.apiKey}>
                Test
              </button>
            </div>
            {s.engine !== 'gemini' && (
              <label className="field">
                Using a Google Cloud server on another address? Paste it here:
                <input
                  value={s.serverUrl}
                  placeholder="https://articulate-xxxxx.asia-south1.run.app"
                  onChange={(e) => update('serverUrl', e.target.value.trim())}
                />
              </label>
            )}
          </>
        )}
        {status && <p className={`small key-status ${statusOk ? 'good' : status === 'Testing…' ? '' : 'error'}`}>{status}</p>}
      </div>

      <UsageCard
        s={s}
        onChange={(patch) => {
          const next = { ...s, ...patch };
          setS(next);
          saveSettings(next);
        }}
      />

      <div className="card">
        <h3>About you</h3>
        <p className="muted small">
          Used to make roleplay clients, AI topics and feedback relevant to your real work. E.g. what you do, what you sell,
          who your clients are, what you are preparing for.
        </p>
        <textarea
          rows={4}
          value={s.aboutMe}
          placeholder="I co-run a small AI software company. We build custom AI tools for public-sector and enterprise clients…"
          onChange={(e) => update('aboutMe', e.target.value)}
        />
      </div>

      <div className="card">
        <h3>Models & voice</h3>
        <label className="field">
          Coach (feedback) model
          <ModelPicker key={`c${resets}`} value={s.coachModel} options={COACH_MODELS} onChange={(v) => update('coachModel', v)} />
        </label>
        {engine === 'gemini' ? (
          <label className="field">
            Live roleplay model
            <ModelPicker key={`l${resets}`} value={s.liveModel} options={LIVE_MODELS} onChange={(v) => update('liveModel', v)} />
          </label>
        ) : (
          <p className="muted small">
            Live roleplay model: chosen by the server — {health?.liveModels?.join(' → ') || 'Gemini 3.8 Live, or 2.5 Native Audio if 3.8 isn’t enabled for your project'}.
          </p>
        )}
        <label className="field">
          Client voice
          <select value={s.voice} onChange={(e) => update('voice', e.target.value)}>
            {VOICES.map((v) => (
              <option key={v} value={v}>
                {v || 'Default'}
              </option>
            ))}
          </select>
        </label>
        <button
          className="link"
          onClick={() => {
            const next = { ...s, coachModel: DEFAULT_SETTINGS.coachModel, liveModel: DEFAULT_SETTINGS.liveModel };
            setS(next);
            saveSettings(next);
            setResets((n) => n + 1);
          }}
        >
          Reset models to defaults
        </button>
      </div>

      <div className="card">
        <h3>Your data</h3>
        <p className="muted small">Sessions and phrasebank live in this browser’s storage. Back them up now and then.</p>
        <div className="row wrap">
          <button onClick={download}>Export backup</button>
          <button onClick={() => fileRef.current?.click()}>Restore backup</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <span className="grow" />
          <button
            className="danger"
            onClick={() => window.confirm('Delete all sessions and phrases? This cannot be undone.') && clearAll()}
          >
            Delete all data
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[][];
  onChange: (v: string) => void;
}) {
  const known = options.some(([id]) => id === value);
  const [custom, setCustom] = useState(!known);
  return (
    <div className="row">
      <select
        value={custom ? '__custom' : value}
        onChange={(e) => {
          if (e.target.value === '__custom') setCustom(true);
          else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
      >
        {options.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
        <option value="__custom">Other model name…</option>
      </select>
      {custom && <input value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="model id" />}
    </div>
  );
}
