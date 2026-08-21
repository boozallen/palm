// Percentile keys for experience level mapping
export enum PercentileKey {
  JUNIOR = 'junior',
  PCT_50 = 'pct50',
  PCT_75 = 'pct75',
  PCT_90 = 'pct90',
}

// Labels for percentile display
export const PERCENTILE_LABELS: Record<PercentileKey, string> = {
  [PercentileKey.JUNIOR]: '',
  [PercentileKey.PCT_50]: '50th',
  [PercentileKey.PCT_75]: '75th',
  [PercentileKey.PCT_90]: '90th',
};

// Keywords for matching experience levels to percentiles
export const EXPERIENCE_LEVEL_KEYWORDS: Record<PercentileKey, string[]> = {
  [PercentileKey.JUNIOR]: ['junior', 'jr', 'entry'],
  [PercentileKey.PCT_50]: ['journeyman', 'mid', 'intermediate'],
  [PercentileKey.PCT_75]: ['senior', 'sr'],
  [PercentileKey.PCT_90]: ['sme', 'expert', 'principal', 'lead'],
};

// Default percentile when no match is found
export const DEFAULT_PERCENTILE = PercentileKey.PCT_50;
