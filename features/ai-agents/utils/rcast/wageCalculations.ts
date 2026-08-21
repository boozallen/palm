import { BlsWageData, DolWageData, SalaryComWageData, ANNUAL_WORK_HOURS } from '@/features/ai-agents/shared/wage-data';
import { PercentileKey, EXPERIENCE_LEVEL_KEYWORDS, DEFAULT_PERCENTILE } from '@/features/ai-agents/types/rcast/experienceLevel';

export const FEE_PERCENT = 12.5;
export const DEFAULT_WRAP_RATE = 2.04;

export function calculateAdjustedRate(billRate: number, wrapRate: number = DEFAULT_WRAP_RATE, localityMultiplier: number = 1.0): number {
  return (billRate * (1 - FEE_PERCENT / 100)) / wrapRate * localityMultiplier;
}

export function formatFeeTooltip(billRate: number, wrapRate: number = DEFAULT_WRAP_RATE, localityMultiplier: number = 1.0): string {
  const adjustedRate = calculateAdjustedRate(billRate, wrapRate, localityMultiplier);
  const localityPart = localityMultiplier !== 1.0 ? ` × ${localityMultiplier.toFixed(4)} (regional cost adjustment)` : '';
  return `Original: $${billRate.toFixed(2)}/hr × (1 - ${FEE_PERCENT}%) ÷ ${wrapRate}${localityPart} = $${adjustedRate.toFixed(2)}/hr`;
}

export function getPercentileForExperienceLevel(experienceLevel: string): PercentileKey {
  const level = experienceLevel.toLowerCase();

  for (const [percentileKey, keywords] of Object.entries(EXPERIENCE_LEVEL_KEYWORDS)) {
    if (keywords.some(keyword => level.includes(keyword))) {
      return percentileKey as PercentileKey;
    }
  }

  return DEFAULT_PERCENTILE;
}

export interface WageDataExtractor {
  getPct10: () => number | null;
  getPct25: () => number | null;
  getPct50: () => number | null;
  getPct75: () => number | null;
  getPct90: () => number | null;
}

export function createBlsExtractor(data: BlsWageData): WageDataExtractor {
  return {
    getPct10: () => data.percentile10Annual != null ? data.percentile10Annual / ANNUAL_WORK_HOURS : null,
    getPct25: () => data.percentile25Annual != null ? data.percentile25Annual / ANNUAL_WORK_HOURS : null,
    getPct50: () => data.percentile50Hourly,
    getPct75: () => data.percentile75Annual != null ? data.percentile75Annual / ANNUAL_WORK_HOURS : null,
    getPct90: () => data.percentile90Annual != null ? data.percentile90Annual / ANNUAL_WORK_HOURS : null,
  };
}

export function createDolExtractor(data: DolWageData): WageDataExtractor {
  return {
    getPct10: () => data.hourlyPct10,
    getPct25: () => data.hourlyPct25,
    getPct50: () => data.hourlyMedian,
    getPct75: () => data.hourlyPct75,
    getPct90: () => data.hourlyPct90,
  };
}

export function createSalaryComExtractor(data: SalaryComWageData): WageDataExtractor {
  return {
    getPct10: () => data.salary10 != null ? data.salary10 / ANNUAL_WORK_HOURS : null,
    getPct25: () => data.salary25 != null ? data.salary25 / ANNUAL_WORK_HOURS : null,
    getPct50: () => data.salary50 != null ? data.salary50 / ANNUAL_WORK_HOURS : null,
    getPct75: () => data.salary75 != null ? data.salary75 / ANNUAL_WORK_HOURS : null,
    getPct90: () => data.salary90 != null ? data.salary90 / ANNUAL_WORK_HOURS : null,
  };
}

export function getWageForPercentile(extractor: WageDataExtractor, percentile: PercentileKey): number | null {
  switch (percentile) {
    case PercentileKey.JUNIOR:
      return extractor.getPct25();
    case PercentileKey.PCT_50:
      return extractor.getPct50();
    case PercentileKey.PCT_75:
      return extractor.getPct75();
    case PercentileKey.PCT_90:
      return extractor.getPct90();
    default:
      return extractor.getPct50();
  }
}

export function getJuniorWages(extractor: WageDataExtractor): { pct10: number | null; pct25: number | null } {
  return {
    pct10: extractor.getPct10(),
    pct25: extractor.getPct25(),
  };
}

export function formatJuniorWagesForExport(extractor: WageDataExtractor): string | null {
  const { pct10, pct25 } = getJuniorWages(extractor);
  if (pct10 != null && pct25 != null) {
    return `$${pct10.toFixed(2)} / $${pct25.toFixed(2)}`;
  } else if (pct25 != null) {
    return `$${pct25.toFixed(2)}`;
  } else if (pct10 != null) {
    return `$${pct10.toFixed(2)}`;
  }
  return null;
}

export function getPercentileLabel(percentile: PercentileKey): string {
  switch (percentile) {
    case PercentileKey.JUNIOR:
      return '10th / 25th';
    case PercentileKey.PCT_50:
      return '50th';
    case PercentileKey.PCT_75:
      return '75th';
    case PercentileKey.PCT_90:
      return '90th';
    default:
      return '50th';
  }
}
