/**
 * BLS Wage Data Types
 * Types for fetching and calculating labor category pricing from BLS API
 */

export interface BlsWageData {
  socCode: string;
  meanAnnualWage: number; // From BLS series ending in 04
  meanHourlyWage: number; // Calculated as meanAnnualWage / ANNUAL_WORK_HOURS
  percentile10Annual: number | null; // From BLS series ending in 11
  percentile25Annual: number | null; // From BLS series ending in 12
  percentile50Annual: number | null; // Calculated via linear interpolation from 25th and 75th percentiles
  percentile50Hourly: number | null; // Calculated from percentile50Annual / ANNUAL_WORK_HOURS
  percentile75Annual: number | null; // From BLS series ending in 13
  percentile90Annual: number | null; // From BLS series ending in 14
  dataYear: string;
  fetchedAt: string;
  // Note: BLS series 06 is unreliable (returns values < 10th percentile)
  // We calculate the 50th percentile via linear interpolation: 25th + (75th - 25th) × 0.5
}
