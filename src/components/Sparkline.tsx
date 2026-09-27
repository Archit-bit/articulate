/** Minimal inline trend line. */
export default function Sparkline({
  values,
  min,
  max,
  label,
  suffix = '',
  better = 'up',
}: {
  values: number[];
  min?: number;
  max?: number;
  label: string;
  suffix?: string;
  better?: 'up' | 'down';
}) {
  const W = 160;
  const H = 40;
  const last = values.at(-1);
  if (values.length < 2) {
    return (
      <div className="spark">
        <div className="spark-head">
          <span>{label}</span>
          <b>{last !== undefined ? `${last}${suffix}` : '—'}</b>
        </div>
        <div className="muted small">Needs 2+ attempts</div>
      </div>
    );
  }
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - ((v - lo) / span) * (H - 8)]);
  const first = values.slice(0, Math.ceil(values.length / 2));
  const second = values.slice(Math.floor(values.length / 2));
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const delta = mean(second) - mean(first);
  const improving = better === 'up' ? delta > 0 : delta < 0;
  return (
    <div className="spark">
      <div className="spark-head">
        <span>{label}</span>
        <b>
          {last}
          {suffix}
        </b>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <polyline points={pts.map((p) => p.join(',')).join(' ')} />
        <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="3" />
      </svg>
      <div className={`small ${Math.abs(delta) < 0.05 ? 'muted' : improving ? 'up' : 'down'}`}>
        {Math.abs(delta) < 0.05 ? 'steady' : improving ? 'improving' : 'slipping'}
      </div>
    </div>
  );
}
