import { PercentileKey } from '@/features/ai-agents/types/rcast/experienceLevel';
import { ANNUAL_WORK_HOURS } from '@/features/ai-agents/shared/wage-data';
import { BlsWageData, DolWageData, SalaryComWageData } from '@/features/ai-agents/shared/wage-data';
import {
  FEE_PERCENT,
  DEFAULT_WRAP_RATE,

  calculateAdjustedRate,
  formatFeeTooltip,
  getPercentileForExperienceLevel,
  createBlsExtractor,
  createDolExtractor,
  createSalaryComExtractor,
  getWageForPercentile,
  getJuniorWages,
  formatJuniorWagesForExport,
  getPercentileLabel,
} from './wageCalculations';

describe('calculateAdjustedRate', () => {
  it('applies fee and wrap rate correctly', () => {
    const rate = 100;
    const expected = (rate * (1 - FEE_PERCENT / 100)) / DEFAULT_WRAP_RATE;
    expect(calculateAdjustedRate(rate)).toBeCloseTo(expected, 6);
  });

  it('returns zero for zero bill rate', () => {
    expect(calculateAdjustedRate(0)).toBe(0);
  });

  it('uses the exported constants', () => {
    expect(FEE_PERCENT).toBe(12.5);
    expect(DEFAULT_WRAP_RATE).toBe(2.04);
  });
});

describe('formatFeeTooltip', () => {
  it('includes bill rate, fee percent, wrap multiplier, and adjusted rate', () => {
    const tooltip = formatFeeTooltip(200);
    expect(tooltip).toContain('$200.00/hr');
    expect(tooltip).toContain('12.5%');
    expect(tooltip).toContain('2.04');
  });

  it('formats adjusted rate to two decimal places', () => {
    const tooltip = formatFeeTooltip(150);
    const adjusted = calculateAdjustedRate(150).toFixed(2);
    expect(tooltip).toContain(`$${adjusted}/hr`);
  });
});

describe('getPercentileForExperienceLevel', () => {
  it.each([
    ['Junior', PercentileKey.JUNIOR],
    ['junior', PercentileKey.JUNIOR],
    ['Jr', PercentileKey.JUNIOR],
    ['entry level', PercentileKey.JUNIOR],
    ['Journeyman', PercentileKey.PCT_50],
    ['Mid-Level', PercentileKey.PCT_50],
    ['intermediate', PercentileKey.PCT_50],
    ['Senior', PercentileKey.PCT_75],
    ['Sr Engineer', PercentileKey.PCT_75],
    ['SME', PercentileKey.PCT_90],
    ['Subject Matter Expert', PercentileKey.PCT_90],
    ['principal', PercentileKey.PCT_90],
    ['lead', PercentileKey.PCT_90],
  ])('maps "%s" to %s', (input, expected) => {
    expect(getPercentileForExperienceLevel(input)).toBe(expected);
  });

  it('defaults to PCT_50 for unrecognized levels', () => {
    expect(getPercentileForExperienceLevel('unknown level')).toBe(PercentileKey.PCT_50);
    expect(getPercentileForExperienceLevel('')).toBe(PercentileKey.PCT_50);
  });
});

const BASE_BLS: BlsWageData = {
  socCode: '15-1252',
  meanAnnualWage: 115200,
  meanHourlyWage: 60,
  percentile10Annual: 57600,
  percentile25Annual: 76800,
  percentile50Annual: 105600,
  percentile50Hourly: 55,
  percentile75Annual: 134400,
  percentile90Annual: 172800,
  dataYear: '2023',
  fetchedAt: '2024-01-01',
};

const BASE_DOL: DolWageData = {
  onetCode: '15-1252.00',
  socCode: '15-1252',
  occupationTitle: 'Software Developer',
  hourlyPct10: 30,
  hourlyPct25: 40,
  hourlyMedian: 55,
  hourlyPct75: 70,
  hourlyPct90: 90,
  annualPct10: 57600,
  annualPct25: 76800,
  annualMedian: 105600,
  annualPct75: 134400,
  annualPct90: 172800,
  location: 'National',
  dataSource: 'DOL',
  dataYear: '2023',
  fetchedAt: '2024-01-01',
};

const BASE_SALARY_COM: SalaryComWageData = {
  jobTitle: 'Software Developer',
  benchmarkJobTitle: 'Software Engineer',
  jobLevelName: 'Senior',
  jobFamilyName: 'Engineering',
  matchRating: 'High',
  salary10: 57600,
  salary25: 76800,
  salary50: 105600,
  salary75: 134400,
  salary90: 172800,
  dataScope: { countryCode: 'USA', industryCode: '', industryName: '' },
  fetchedAt: '2024-01-01',
};

describe('createBlsExtractor', () => {
  it('converts annual figures to hourly via ANNUAL_WORK_HOURS', () => {
    const extractor = createBlsExtractor(BASE_BLS);
    expect(extractor.getPct10()).toBeCloseTo(BASE_BLS.percentile10Annual! / ANNUAL_WORK_HOURS, 6);
    expect(extractor.getPct25()).toBeCloseTo(BASE_BLS.percentile25Annual! / ANNUAL_WORK_HOURS, 6);
    expect(extractor.getPct75()).toBeCloseTo(BASE_BLS.percentile75Annual! / ANNUAL_WORK_HOURS, 6);
    expect(extractor.getPct90()).toBeCloseTo(BASE_BLS.percentile90Annual! / ANNUAL_WORK_HOURS, 6);
  });

  it('returns pct50 as direct hourly (not converted from annual)', () => {
    const extractor = createBlsExtractor(BASE_BLS);
    expect(extractor.getPct50()).toBe(BASE_BLS.percentile50Hourly);
  });

  it('returns null when annual percentile fields are null', () => {
    const data: BlsWageData = { ...BASE_BLS, percentile10Annual: null, percentile25Annual: null };
    const extractor = createBlsExtractor(data);
    expect(extractor.getPct10()).toBeNull();
    expect(extractor.getPct25()).toBeNull();
  });

  it('returns null for pct50 when percentile50Hourly is null', () => {
    const data: BlsWageData = { ...BASE_BLS, percentile50Hourly: null };
    expect(createBlsExtractor(data).getPct50()).toBeNull();
  });
});

describe('createDolExtractor', () => {
  it('passes through hourly values directly', () => {
    const extractor = createDolExtractor(BASE_DOL);
    expect(extractor.getPct10()).toBe(BASE_DOL.hourlyPct10);
    expect(extractor.getPct25()).toBe(BASE_DOL.hourlyPct25);
    expect(extractor.getPct50()).toBe(BASE_DOL.hourlyMedian);
    expect(extractor.getPct75()).toBe(BASE_DOL.hourlyPct75);
    expect(extractor.getPct90()).toBe(BASE_DOL.hourlyPct90);
  });
});

describe('createSalaryComExtractor', () => {
  it('converts annual salaries to hourly via ANNUAL_WORK_HOURS', () => {
    const extractor = createSalaryComExtractor(BASE_SALARY_COM);
    expect(extractor.getPct10()).toBeCloseTo(BASE_SALARY_COM.salary10 / ANNUAL_WORK_HOURS, 6);
    expect(extractor.getPct25()).toBeCloseTo(BASE_SALARY_COM.salary25 / ANNUAL_WORK_HOURS, 6);
    expect(extractor.getPct50()).toBeCloseTo(BASE_SALARY_COM.salary50 / ANNUAL_WORK_HOURS, 6);
    expect(extractor.getPct75()).toBeCloseTo(BASE_SALARY_COM.salary75 / ANNUAL_WORK_HOURS, 6);
    expect(extractor.getPct90()).toBeCloseTo(BASE_SALARY_COM.salary90 / ANNUAL_WORK_HOURS, 6);
  });
});

describe('getWageForPercentile', () => {
  const extractor = createDolExtractor(BASE_DOL);

  it('returns pct25 for JUNIOR', () => {
    expect(getWageForPercentile(extractor, PercentileKey.JUNIOR)).toBe(BASE_DOL.hourlyPct25);
  });

  it('returns pct50 for PCT_50', () => {
    expect(getWageForPercentile(extractor, PercentileKey.PCT_50)).toBe(BASE_DOL.hourlyMedian);
  });

  it('returns pct75 for PCT_75', () => {
    expect(getWageForPercentile(extractor, PercentileKey.PCT_75)).toBe(BASE_DOL.hourlyPct75);
  });

  it('returns pct90 for PCT_90', () => {
    expect(getWageForPercentile(extractor, PercentileKey.PCT_90)).toBe(BASE_DOL.hourlyPct90);
  });
});

describe('getJuniorWages', () => {
  it('returns both pct10 and pct25', () => {
    const extractor = createDolExtractor(BASE_DOL);
    const result = getJuniorWages(extractor);
    expect(result.pct10).toBe(BASE_DOL.hourlyPct10);
    expect(result.pct25).toBe(BASE_DOL.hourlyPct25);
  });

  it('returns nulls when BLS annual fields are absent', () => {
    const data: BlsWageData = { ...BASE_BLS, percentile10Annual: null, percentile25Annual: null };
    const result = getJuniorWages(createBlsExtractor(data));
    expect(result.pct10).toBeNull();
    expect(result.pct25).toBeNull();
  });
});

describe('formatJuniorWagesForExport', () => {
  it('formats both percentiles as "$X.XX / $Y.XX"', () => {
    const extractor = createDolExtractor(BASE_DOL);
    const result = formatJuniorWagesForExport(extractor);
    expect(result).toBe(`$${BASE_DOL.hourlyPct10.toFixed(2)} / $${BASE_DOL.hourlyPct25.toFixed(2)}`);
  });

  it('returns only pct25 string when pct10 is null (BLS with missing 10th)', () => {
    const data: BlsWageData = { ...BASE_BLS, percentile10Annual: null };
    const result = formatJuniorWagesForExport(createBlsExtractor(data));
    const expected = `$${(BASE_BLS.percentile25Annual! / ANNUAL_WORK_HOURS).toFixed(2)}`;
    expect(result).toBe(expected);
  });

  it('returns only pct10 string when pct25 is null (BLS with missing 25th)', () => {
    const data: BlsWageData = { ...BASE_BLS, percentile25Annual: null };
    const result = formatJuniorWagesForExport(createBlsExtractor(data));
    const expected = `$${(BASE_BLS.percentile10Annual! / ANNUAL_WORK_HOURS).toFixed(2)}`;
    expect(result).toBe(expected);
  });

  it('returns null when both pct10 and pct25 are null', () => {
    const data: BlsWageData = { ...BASE_BLS, percentile10Annual: null, percentile25Annual: null };
    expect(formatJuniorWagesForExport(createBlsExtractor(data))).toBeNull();
  });
});

describe('getPercentileLabel', () => {
  it.each([
    [PercentileKey.JUNIOR, '10th / 25th'],
    [PercentileKey.PCT_50, '50th'],
    [PercentileKey.PCT_75, '75th'],
    [PercentileKey.PCT_90, '90th'],
  ])('returns correct label for %s', (key, label) => {
    expect(getPercentileLabel(key)).toBe(label);
  });
});
