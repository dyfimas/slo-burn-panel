export interface SloBurnOptions {
  /** SLO target as percentage, e.g. 99.9 */
  sloTarget: number;
  /** Compliance window in days, e.g. 30 */
  windowDays: number;
  /** Whether the input series represents error ratio (true) or success ratio (false) */
  isErrorRatio: boolean;
  /** Optional field name hint to pick from multi-field frames */
  seriesFieldHint: string;
  /** Short burn window in points for fast-burn detection */
  shortWindow: number;
  /** Long burn window in points for slow-burn detection */
  longWindow: number;
}

export type BurnStatus = 'SAFE' | 'SLOW_BURN' | 'FAST_BURN' | 'EXHAUSTED' | 'NO_DATA';

export interface BurnWindow {
  label: string;
  rate: number;
  points: number;
}

export interface SloBurnAnalysis {
  /** Error budget fraction (0-1), e.g. 0.001 for 99.9% SLO */
  errorBudget: number;
  /** Fraction of budget consumed so far (0-1+) */
  budgetConsumed: number;
  /** Fraction of budget remaining (can be negative) */
  budgetRemaining: number;
  /** Current short-window burn rate (multiples of allowed rate) */
  shortBurnRate: number;
  /** Current long-window burn rate */
  longBurnRate: number;
  /** Overall burn rate across all data */
  overallBurnRate: number;
  /** Operational status */
  status: BurnStatus;
  /** Projected days until budget exhaustion (Infinity if safe) */
  projectedExhaustionDays: number;
  /** Per-point burn rate for sparkline */
  burnRateTimeline: number[];
  /** Per-point cumulative budget consumption */
  budgetTimeline: number[];
  /** Current error rate observed */
  currentErrorRate: number;
  /** Allowed error rate = 1 - SLO */
  allowedErrorRate: number;
  /** Total data points */
  totalPoints: number;
}
