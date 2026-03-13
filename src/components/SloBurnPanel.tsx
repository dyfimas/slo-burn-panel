import React, { useMemo } from 'react';
import { FieldType, PanelProps } from '@grafana/data';
import { SloBurnOptions, SloBurnAnalysis, BurnStatus } from '../types';

/* ── data extraction ──────────────────────────────────── */
function extractErrorRatios(
  series: PanelProps<SloBurnOptions>['data']['series'],
  hint: string,
  isErrorRatio: boolean
): number[] {
  const h = (hint || '').toLowerCase().trim();
  for (const frame of series) {
    const nums = frame.fields.filter(f => f.type === FieldType.number);
    if (!nums.length) continue;
    const field = h ? nums.find(f => (f.name || '').toLowerCase().includes(h)) || nums[0] : nums[0];
    const out: number[] = [];
    for (let i = 0; i < field.values.length; i++) {
      const v = Number(field.values[i]);
      if (!Number.isFinite(v)) continue;
      const clamped = Math.max(0, Math.min(1, v));
      out.push(isErrorRatio ? clamped : 1 - clamped);
    }
    if (out.length > 0) return out;
  }
  return [];
}

/* ── deterministic demo data ──────────────────────────── */
function generateDemoData(): number[] {
  const pts: number[] = [];
  const seed = [0.13, 0.76, 0.42, 0.91, 0.28, 0.55, 0.83, 0.37, 0.61, 0.09,
    0.47, 0.72, 0.18, 0.94, 0.33, 0.67, 0.88, 0.21, 0.56, 0.79];
  for (let i = 0; i < 300; i++) {
    const r = seed[i % seed.length];
    // baseline ~ 0.04% error rate (well within 99.9% SLO budget of 0.1%)
    let errorRate = 0.0004 + (r - 0.5) * 0.00015;
    // incident at points 120-130: error rate spikes to ~1% (10x burn)
    if (i >= 120 && i <= 130) errorRate = 0.008 + (r * 0.006);
    // smaller degradation at 200-210: ~0.3% (3x burn, slow burn territory)
    if (i >= 200 && i <= 210) errorRate = 0.002 + (r * 0.002);
    // recovery — back to normal after each incident
    pts.push(Math.max(0, Math.min(1, errorRate)));
  }
  return pts;
}

const DEMO_LABEL = '⚡ demo · http_error_ratio';

/* ── analysis engine ──────────────────────────────────── */
function analyze(errorRatios: number[], opts: SloBurnOptions): SloBurnAnalysis {
  const sloFraction = opts.sloTarget / 100;
  const allowedErrorRate = 1 - sloFraction;
  const errorBudget = allowedErrorRate;

  if (errorRatios.length === 0) {
    return {
      errorBudget, budgetConsumed: 0, budgetRemaining: 1,
      shortBurnRate: 0, longBurnRate: 0, overallBurnRate: 0,
      status: 'NO_DATA', projectedExhaustionDays: Infinity,
      burnRateTimeline: [], budgetTimeline: [],
      currentErrorRate: 0, allowedErrorRate, totalPoints: 0,
    };
  }

  const n = errorRatios.length;
  const shortWin = Math.min(opts.shortWindow || 12, n);
  const longWin = Math.min(opts.longWindow || 72, n);

  const windowMean = (end: number, size: number): number => {
    const start = Math.max(0, end - size);
    let sum = 0;
    const count = end - start;
    for (let i = start; i < end; i++) sum += errorRatios[i];
    return count > 0 ? sum / count : 0;
  };

  let totalSum = 0;
  for (let i = 0; i < n; i++) totalSum += errorRatios[i];
  const overallMean = totalSum / n;

  const shortMean = windowMean(n, shortWin);
  const longMean = windowMean(n, longWin);

  const shortBurnRate = allowedErrorRate > 0 ? shortMean / allowedErrorRate : 0;
  const longBurnRate = allowedErrorRate > 0 ? longMean / allowedErrorRate : 0;
  const overallBurnRate = allowedErrorRate > 0 ? overallMean / allowedErrorRate : 0;

  const budgetConsumed = overallBurnRate;
  const budgetRemaining = Math.max(0, 1 - budgetConsumed);

  let status: BurnStatus;
  if (budgetConsumed >= 1) {
    status = 'EXHAUSTED';
  } else if (shortBurnRate >= 14.4 && longBurnRate >= 6) {
    status = 'FAST_BURN';
  } else if (shortBurnRate >= 6 && longBurnRate >= 3) {
    status = 'FAST_BURN';
  } else if (longBurnRate >= 1) {
    status = 'SLOW_BURN';
  } else {
    status = 'SAFE';
  }

  const projectedExhaustionDays = overallBurnRate > 0
    ? (opts.windowDays * (1 - budgetConsumed)) / overallBurnRate
    : Infinity;

  const burnRateTimeline: number[] = [];
  const budgetTimeline: number[] = [];
  let cumError = 0;
  for (let i = 0; i < n; i++) {
    burnRateTimeline.push(allowedErrorRate > 0 ? errorRatios[i] / allowedErrorRate : 0);
    cumError += errorRatios[i];
    budgetTimeline.push(allowedErrorRate > 0 ? (cumError / (n * allowedErrorRate)) : 0);
  }

  return {
    errorBudget, budgetConsumed, budgetRemaining,
    shortBurnRate, longBurnRate, overallBurnRate,
    status, projectedExhaustionDays,
    burnRateTimeline, budgetTimeline,
    currentErrorRate: shortMean,
    allowedErrorRate, totalPoints: n,
  };
}

/* ── color/style helpers ──────────────────────────────── */
const STATUS_COLORS: Record<BurnStatus, { main: string; bg: string; label: string }> = {
  SAFE:       { main: '#22c55e', bg: 'rgba(34,197,94,0.10)',  label: 'SAFE' },
  SLOW_BURN:  { main: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'SLOW BURN' },
  FAST_BURN:  { main: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: 'FAST BURN' },
  EXHAUSTED:  { main: '#dc2626', bg: 'rgba(220,38,38,0.15)',  label: 'EXHAUSTED' },
  NO_DATA:    { main: '#64748b', bg: 'rgba(100,116,139,0.08)', label: 'NO DATA' },
};

function fmtBurnRate(v: number): string {
  if (v >= 100) return v.toFixed(0) + 'x';
  if (v >= 10) return v.toFixed(1) + 'x';
  return v.toFixed(2) + 'x';
}

function fmtPercent(v: number): string {
  const pct = v * 100;
  if (pct >= 10) return pct.toFixed(1) + '%';
  if (pct >= 1) return pct.toFixed(2) + '%';
  if (pct >= 0.01) return pct.toFixed(3) + '%';
  return pct.toFixed(4) + '%';
}

function fmtDays(d: number): string {
  if (!Number.isFinite(d)) return '∞';
  if (d < 0) return '0d';
  if (d < 1) return (d * 24).toFixed(1) + 'h';
  return d.toFixed(1) + 'd';
}

/* ── component ─────────────────────────────────────────── */
export const SloBurnPanel: React.FC<PanelProps<SloBurnOptions>> = ({ width, height, options, data }) => {
  const realValues = useMemo(
    () => extractErrorRatios(data.series, options.seriesFieldHint || '', options.isErrorRatio !== false),
    [data.series, options.seriesFieldHint, options.isErrorRatio]
  );
  const isDemo = realValues.length === 0;
  const values = isDemo ? useMemo(generateDemoData, []) : realValues;

  const analysis = useMemo(() => analyze(values, {
    ...options,
    sloTarget: options.sloTarget || 99.9,
    windowDays: options.windowDays || 30,
    shortWindow: options.shortWindow || 12,
    longWindow: options.longWindow || 72,
  }), [values, options.sloTarget, options.windowDays, options.shortWindow, options.longWindow]);

  const { status, budgetConsumed, budgetRemaining, shortBurnRate, longBurnRate,
          overallBurnRate, projectedExhaustionDays, burnRateTimeline, budgetTimeline,
          currentErrorRate, allowedErrorRate, totalPoints } = analysis;

  const col = STATUS_COLORS[status];
  const isCompact = height < 300;

  /* ── gauge arc — compact proportional ──────────────── */
  const gaugeMaxW = isCompact ? 140 : 160;
  const gaugeW = Math.min(width - 40, gaugeMaxW);
  const gaugeH = gaugeW * 0.48;
  const cx = gaugeW / 2, cy = gaugeH;
  const gR = gaugeW * 0.40;
  const arcStroke = Math.max(6, gaugeW * 0.045);

  // Arc from π (left) to 0 (right) — full 180° semicircle
  // Budget remaining fills from right→left, consumed from left→right
  const budgetPct = Math.max(0, Math.min(1, 1 - budgetConsumed));
  // Angle where consumed meets remaining
  const splitAngle = Math.PI * budgetPct; // π=100% left, 0=0% left

  const arcD = (fromAngle: number, toAngle: number): string => {
    // Arc drawn clockwise from fromAngle to toAngle
    const x1 = cx + gR * Math.cos(fromAngle);
    const y1 = cy - gR * Math.sin(fromAngle);
    const x2 = cx + gR * Math.cos(toAngle);
    const y2 = cy - gR * Math.sin(toAngle);
    const sweep = fromAngle - toAngle;
    const large = sweep > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${gR} ${gR} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };

  const budgetCol = budgetPct > 0.5 ? '#22c55e' : budgetPct > 0.2 ? '#f59e0b' : '#ef4444';
  const consumedCol = budgetConsumed >= 1 ? '#dc2626' : budgetConsumed > 0.5 ? '#ef4444' : 'rgba(239,68,68,0.35)';

  // Needle pointing to split angle
  const needleLen = gR * 0.65;
  const nx = cx + needleLen * Math.cos(splitAngle);
  const ny = cy - needleLen * Math.sin(splitAngle);

  /* ── sparkline (burn rate) ─────────────────────────── */
  const pad = { t: 4, r: 4, b: 6, l: 28 };
  const sparkW = width - 28;
  // Allocate proportional space: header ~50px, gauge ~gaugeH+20, stats ~50, bar ~20 → rest for spark
  const fixedH = (isCompact ? 38 : 46) + gaugeH + 20 + 50 + 26;
  const sparkH = Math.max(36, height - fixedH);
  const pW = sparkW - pad.l - pad.r;
  const pH = sparkH - pad.t - pad.b;

  let brMax = 2;
  for (const v of burnRateTimeline) { if (v > brMax) brMax = v; }
  brMax = Math.ceil(brMax * 1.1);
  const brRange = brMax || 1;
  const bsx = (i: number) => pad.l + (i / Math.max(burnRateTimeline.length - 1, 1)) * pW;
  const bsy = (v: number) => pad.t + pH - ((Math.min(v, brMax)) / brRange) * pH;

  const sparkPath: string[] = [];
  for (let i = 0; i < burnRateTimeline.length; i++) {
    sparkPath.push(`${i === 0 ? 'M' : 'L'}${bsx(i).toFixed(1)},${bsy(burnRateTimeline[i]).toFixed(1)}`);
  }
  // Fill area under curve
  const sparkFill = burnRateTimeline.length > 1
    ? sparkPath.join(' ') + ` L${bsx(burnRateTimeline.length - 1).toFixed(1)},${bsy(0).toFixed(1)} L${bsx(0).toFixed(1)},${bsy(0).toFixed(1)} Z`
    : '';

  const threshY = bsy(1);

  return (
    <div style={{
      width, height, boxSizing: 'border-box', padding: '10px 14px',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.97), rgba(30,41,59,0.97))',
      color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif',
      borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* ── header ──────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={16} height={16} viewBox="0 0 128 128" style={{ flexShrink: 0 }}>
            <rect x="4" y="4" width="120" height="120" rx="24" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="8"/>
            <path d="M 34 88 A 38 38 0 1 1 94 88" fill="none" stroke="#334155" strokeWidth="7" strokeLinecap="round"/>
            <path d="M 34 88 A 38 38 0 1 1 88 56" fill="none" stroke="#22c55e" strokeWidth="7" strokeLinecap="round"/>
            <circle cx="64" cy="86" r="4" fill="#f59e0b"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.4 }}>SLO BURN RATE</span>
        </div>
        <span style={{
          padding: '1px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
          background: col.bg, color: col.main, border: `1px solid ${col.main}`,
        }}>{col.label}</span>
      </div>

      {isDemo && <div style={{ fontSize: 8, color: '#818cf8', marginBottom: 1, flexShrink: 0 }}>{DEMO_LABEL}</div>}

      {/* ── SLO info line ───────────────────────────── */}
      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3, flexShrink: 0 }}>
        SLO: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{(options.sloTarget || 99.9)}%</span>
        {' · '}Window: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{options.windowDays || 30}d</span>
        {' · '}Budget: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{fmtPercent(allowedErrorRate)}</span>
      </div>

      {/* ── gauge + budget % ────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', flexShrink: 0, marginBottom: 4, position: 'relative' }}>
        <svg width={gaugeW} height={gaugeH + 14} style={{ overflow: 'visible' }}>
          {/* background arc */}
          <path d={arcD(Math.PI, 0)} fill="none" stroke="#1e293b" strokeWidth={arcStroke} strokeLinecap="round"/>
          {/* remaining budget arc (green side, from left) */}
          {budgetPct > 0.01 && (
            <path d={arcD(Math.PI, splitAngle)} fill="none" stroke={budgetCol} strokeWidth={arcStroke} strokeLinecap="round"/>
          )}
          {/* consumed arc (red side, from right) */}
          {budgetConsumed > 0.01 && (
            <path d={arcD(splitAngle, 0)} fill="none" stroke={consumedCol} strokeWidth={arcStroke} strokeLinecap="round"/>
          )}
          {/* needle */}
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round"/>
          <circle cx={cx} cy={cy} r={2.5} fill="#cbd5e1"/>
          {/* center text  — budget remaining % */}
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize={16} fontWeight="bold" fill={budgetCol}>
            {(budgetPct * 100).toFixed(1)}%
          </text>
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fill="#94a3b8">budget left</text>
          {/* edge labels */}
          <text x={cx - gR - 2} y={cy + 12} fontSize={7} fill="#475569" textAnchor="middle">0%</text>
          <text x={cx + gR + 2} y={cy + 12} fontSize={7} fill="#475569" textAnchor="middle">100%</text>
        </svg>
      </div>

      {/* ── burn rate sparkline ─────────────────────── */}
      {burnRateTimeline.length > 1 && sparkH > 20 && (
        <div style={{ flex: 1, minHeight: 0, flexShrink: 1, marginBottom: 2 }}>
          <div style={{ fontSize: 8, color: '#64748b', marginBottom: 1 }}>BURN RATE</div>
          <svg width={sparkW} height={Math.max(sparkH, 36)} style={{ display: 'block' }}>
            {/* fill area */}
            {sparkFill && <path d={sparkFill} fill="rgba(96,165,250,0.08)"/>}
            {/* 1x threshold */}
            <line x1={pad.l} y1={threshY} x2={pad.l + pW} y2={threshY}
              stroke="rgba(239,68,68,0.4)" strokeWidth={1} strokeDasharray="3,3"/>
            <text x={pad.l - 3} y={threshY + 3} fontSize={7} fill="#ef4444" textAnchor="end">1x</text>
            {/* line */}
            <path d={sparkPath.join(' ')} fill="none" stroke="#60a5fa" strokeWidth={1.5}/>
            {/* hot points above threshold */}
            {burnRateTimeline.map((v, i) => v >= 1 ? (
              <circle key={i} cx={bsx(i)} cy={bsy(v)} r={1.5} fill="#ef4444" opacity={0.8}/>
            ) : null)}
            {/* axis */}
            <text x={pad.l - 3} y={pad.t + 4} fontSize={6} fill="#475569" textAnchor="end">{brMax}x</text>
            <text x={pad.l - 3} y={pad.t + pH - 1} fontSize={6} fill="#475569" textAnchor="end">0</text>
          </svg>
        </div>
      )}

      {/* ── budget consumption bar ──────────────────── */}
      <div style={{ flexShrink: 0, marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#64748b', marginBottom: 2 }}>
          <span>BUDGET CONSUMED</span>
          <span style={{ color: budgetConsumed >= 1 ? '#ef4444' : budgetConsumed > 0.8 ? '#f59e0b' : '#22c55e', fontWeight: 700, fontSize: 9 }}>
            {(budgetConsumed * 100).toFixed(1)}%
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(budgetConsumed * 100, 100)}%`,
            borderRadius: 3,
            background: budgetConsumed >= 1
              ? 'linear-gradient(90deg, #ef4444, #dc2626)'
              : budgetConsumed > 0.8
                ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
            transition: 'width 0.3s',
          }}/>
        </div>
      </div>

      {/* ── stats row (compact 2-row grid) ──────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px 6px',
        fontSize: 9, color: '#64748b', flexShrink: 0,
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: shortBurnRate >= 6 ? '#ef4444' : shortBurnRate >= 1 ? '#f59e0b' : '#e2e8f0', fontSize: 13, fontWeight: 700, display: 'block', lineHeight: 1.1 }}>
            {fmtBurnRate(shortBurnRate)}
          </span>
          <span>Short</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: longBurnRate >= 3 ? '#ef4444' : longBurnRate >= 1 ? '#f59e0b' : '#e2e8f0', fontSize: 13, fontWeight: 700, display: 'block', lineHeight: 1.1 }}>
            {fmtBurnRate(longBurnRate)}
          </span>
          <span>Long</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, display: 'block', lineHeight: 1.1 }}>
            {fmtBurnRate(overallBurnRate)}
          </span>
          <span>Overall</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#e2e8f0', display: 'block', fontSize: 10 }}>{fmtPercent(currentErrorRate)}</span>
          <span>Err Rate</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: projectedExhaustionDays < (options.windowDays || 30) ? '#f59e0b' : '#e2e8f0', display: 'block', fontSize: 10 }}>
            {fmtDays(projectedExhaustionDays)}
          </span>
          <span>TTL</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#e2e8f0', display: 'block', fontSize: 10 }}>{totalPoints}</span>
          <span>Points</span>
        </div>
      </div>
    </div>
  );
};
