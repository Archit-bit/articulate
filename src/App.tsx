import { useEffect, useState } from 'react';
import { useEngine } from './lib/engine';
import { stats, useStoreVersion } from './lib/store';
import Explain from './screens/Explain';
import History from './screens/History';
import Home from './screens/Home';
import Impromptu from './screens/Impromptu';
import Phrasebank from './screens/Phrasebank';
import Rephrase from './screens/Rephrase';
import Roleplay from './screens/Roleplay';
import Settings from './screens/Settings';

const NAV = [
  { id: 'home', label: 'Today', group: '' },
  { id: 'rephrase', label: 'Rephrase', group: 'Drills' },
  { id: 'impromptu', label: 'Impromptu', group: 'Drills' },
  { id: 'explain', label: 'Explain & compress', group: 'Drills' },
  { id: 'roleplay', label: 'Client roleplay', group: 'Drills' },
  { id: 'phrasebank', label: 'Phrasebank', group: 'You' },
  { id: 'history', label: 'History', group: 'You' },
  { id: 'settings', label: 'Settings', group: 'You' },
];

function currentRoute() {
  const r = window.location.hash.replace('#/', '').replace('#', '');
  return NAV.some((n) => n.id === r) ? r : 'home';
}

export default function App() {
  useStoreVersion();
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const on = () => setRoute(currentRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = (r: string) => {
    window.location.hash = `#/${r}`;
    window.scrollTo(0, 0);
  };

  const { engine, ready, checking } = useEngine();
  const hasKey = ready || checking;
  const { streak } = stats();

  let screen;
  switch (route) {
    case 'rephrase':
      screen = <Rephrase />;
      break;
    case 'impromptu':
      screen = <Impromptu />;
      break;
    case 'explain':
      screen = <Explain />;
      break;
    case 'roleplay':
      screen = <Roleplay />;
      break;
    case 'phrasebank':
      screen = <Phrasebank />;
      break;
    case 'history':
      screen = <History />;
      break;
    case 'settings':
      screen = <Settings />;
      break;
    default:
      screen = <Home go={go} />;
  }

  let lastGroup = '';
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand" onClick={() => go('home')}>
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 32 32">
              <rect x="12" y="5" width="8" height="15" rx="4" />
              <path d="M8 15a8 8 0 0 0 16 0M16 23v4" />
            </svg>
          </span>
          Articulate
        </div>
        {streak > 0 && <div className="streak">{streak}-day streak</div>}
        <div className="nav-items">
          {NAV.map((n) => {
            const header = n.group && n.group !== lastGroup ? n.group : '';
            lastGroup = n.group;
            return (
              <div key={n.id} className="nav-wrap">
                {header && <div className="nav-group">{header}</div>}
                <button className={`nav ${route === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
                  {n.label}
                  {n.id === 'settings' && !hasKey && <span className="needs">!</span>}
                </button>
              </div>
            );
          })}
        </div>
      </nav>
      <main className="main">
        {!hasKey && route !== 'settings' && route !== 'home' && (
          <div className="banner">
            {engine === 'server' ? 'Enter the team passcode' : 'Add your Gemini API key'} in{' '}
            <button className="link" onClick={() => go('settings')}>
              Settings
            </button>{' '}
            to get feedback.
          </div>
        )}
        {screen}
      </main>
    </div>
  );
}
