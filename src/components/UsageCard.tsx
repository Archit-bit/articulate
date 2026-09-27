import { LIVE_PER_MIN, formatMoney } from '../lib/pricing';
import { currentEngine } from '../lib/engine';
import { usageSummary, useStoreVersion } from '../lib/store';
import type { Settings } from '../lib/types';

export default function UsageCard({ s, onChange }: { s: Settings; onChange: (patch: Partial<Settings>) => void }) {
  useStoreVersion();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const month = usageSummary(monthStart);
  const all = usageSummary(0);
  const m = formatMoney(month.usd, s.usdInr);
  const a = formatMoney(all.usd, s.usdInr);
  const perDrill = all.drills ? formatMoney(all.drillUsd / all.drills, s.usdInr) : null;
  const tenMinRoleplay = formatMoney(10 * LIVE_PER_MIN.in + 5 * LIVE_PER_MIN.out, s.usdInr); // ~half the time the client talks
  const monthName = now.toLocaleDateString(undefined, { month: 'long' });
  const gcp = currentEngine(s) === 'server';
  const paid = gcp || s.billingEnabled;

  return (
    <div className="card">
      <h3>Usage & cost</h3>
      {gcp ? (
        <p className="small" style={{ margin: 0 }}>
          Billed to your <b>Google Cloud project</b> and paid from your credits. See what’s left under{' '}
          <a href="https://console.cloud.google.com/billing" target="_blank" rel="noreferrer">
            Billing → Credits
          </a>
          .
        </p>
      ) : (
        <div className="row wrap" style={{ marginTop: 0 }}>
          <div className="segmented">
            <button className={!s.billingEnabled ? 'on' : ''} onClick={() => onChange({ billingEnabled: false })}>
              Free tier
            </button>
            <button className={s.billingEnabled ? 'on' : ''} onClick={() => onChange({ billingEnabled: true })}>
              Billing on
            </button>
          </div>
          <span className="muted small">Which one is your key on? Check aistudio.google.com/api-keys.</span>
        </div>
      )}

      <div className="stat-row usage">
        <div className="stat">
          <b>{paid ? m.inr : '₹0'}</b>
          <span>
            {paid ? `est. ${monthName} (${m.usd})` : `charged in ${monthName} — would be ≈ ${m.inr} on paid`}
          </span>
        </div>
        <div className="stat">
          <b>{month.drills}</b>
          <span>drills this month</span>
        </div>
        <div className="stat">
          <b>{month.roleplayMin < 10 ? month.roleplayMin.toFixed(1) : Math.round(month.roleplayMin)}</b>
          <span>roleplay minutes this month</span>
        </div>
        <div className="stat">
          <b>{paid ? a.inr : '₹0'}</b>
          <span>{paid ? `est. all time (${a.usd})` : `all time — ≈ ${a.inr} on paid`}</span>
        </div>
      </div>

      <p className="muted small">
        Rough guide on the paid tier: one drill ≈ {perDrill ? perDrill.inr : 'under ₹1'}, a 10-minute roleplay ≈{' '}
        {tenMinRoleplay.inr}. {gcp ? `The $300 trial credit (≈ ${formatMoney(300, s.usdInr).inr}) covers thousands of drills or hundreds of roleplays; it expires 90 days after sign-up.` : 'On the free tier Google charges nothing (within its rate limits).'}
      </p>
      {gcp ? (
        <p className="small">
          <b>Real numbers from Google Cloud</b> (can lag a day):{' '}
          <a href="https://console.cloud.google.com/billing/reports" target="_blank" rel="noreferrer">
            Billing reports
          </a>{' '}
          ·{' '}
          <a href="https://console.cloud.google.com/billing/budgets" target="_blank" rel="noreferrer">
            Set a budget alert
          </a>
        </p>
      ) : (
        <p className="small">
          <b>Real numbers from Google</b> (can lag up to 24 h):{' '}
          <a href="https://aistudio.google.com/usage" target="_blank" rel="noreferrer">
            Usage
          </a>{' '}
          ·{' '}
          <a href="https://aistudio.google.com/billing" target="_blank" rel="noreferrer">
            Billing
          </a>{' '}
          ·{' '}
          <a href="https://aistudio.google.com/spend" target="_blank" rel="noreferrer">
            Set a monthly spend cap
          </a>
        </p>
      )}
      <div className="row wrap">
        <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
          ₹ per US$
          <input
            type="number"
            min={1}
            step={0.5}
            value={s.usdInr}
            style={{ width: 90 }}
            onChange={(e) => onChange({ usdInr: Math.max(1, Number(e.target.value) || 96) })}
          />
        </label>
        <span className="muted small">
          This estimate counts usage from this browser only, priced at Google’s list rates.
        </span>
      </div>
    </div>
  );
}
