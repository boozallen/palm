import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';

// Number formatting and delta arithmetic for the Context Studio Value view.
// Pure and dependency-free apart from the shared currency formatter, so the
// arithmetic can be tested without rendering anything.

export type DeltaDirection = 'up' | 'down' | 'flat';

export type DeltaReadout = {
  text: string;
  direction: DeltaDirection;
};

const EM_DASH = '—';

// 'flat' rather than a fabricated percentage. A prior period of zero makes the
// change infinite, and rendering '+∞%' or silently showing '+100%' both invite a
// reader to draw a conclusion the data does not support.
const NO_PRIOR: DeltaReadout = { text: 'no prior data', direction: 'flat' };
const FLAT: DeltaReadout = { text: 'flat vs prior', direction: 'flat' };

// Null, never NaN or 0: a zero denominator means the rate is unknown, and 0 would
// assert that nothing was put to work when in fact nothing was created.
export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }
  return numerator / denominator;
}

export function formatPercent(value: number | null): string {
  if (value === null) {
    return EM_DASH;
  }
  return `${Math.round(value * 100)}%`;
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

export function formatHours(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function formatHoursPerPerson(value: number | null): string {
  if (value === null) {
    return EM_DASH;
  }
  return value.toFixed(1);
}

export function formatUnitCost(value: number | null): string {
  if (value === null) {
    return EM_DASH;
  }
  return formatCurrencyNumberForAnalytics(value);
}

export function percentDelta(value: number, previous: number): DeltaReadout {
  if (previous <= 0) {
    return NO_PRIOR;
  }
  const change = Math.round(((value - previous) / previous) * 100);
  if (change === 0) {
    return FLAT;
  }
  return {
    text: `${change > 0 ? '+' : ''}${change}% vs prior`,
    direction: change > 0 ? 'up' : 'down',
  };
}

// For the one tile whose headline is itself a rate. A rate's movement is measured
// in percentage points, not percent: 41% to 46% is +5pts, and calling it +12%
// would be a different, correct-looking, wrong number.
export function pointsDelta(value: number | null, previous: number | null): DeltaReadout {
  if (value === null || previous === null) {
    return NO_PRIOR;
  }
  const change = Math.round((value - previous) * 100);
  if (change === 0) {
    return FLAT;
  }
  return {
    text: `${change > 0 ? '+' : ''}${change}pts vs prior`,
    direction: change > 0 ? 'up' : 'down',
  };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) { return `${hours}h ${minutes}m`; }
  if (minutes > 0) { return `${minutes}m ${seconds}s`; }
  return `${seconds}s`;
}

export function formatTokens(tokens: number): string {
  if (!Number.isFinite(tokens)) { return '0'; }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
}
