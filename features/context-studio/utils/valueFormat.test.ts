import {
  formatCount,
  formatHours,
  formatHoursPerPerson,
  formatPercent,
  formatUnitCost,
  percentDelta,
  pointsDelta,
  rate,
} from './valueFormat';

describe('rate', () => {
  it('returns the fraction', () => {
    expect(rate(1847, 4012)).toBeCloseTo(0.4604, 4);
  });

  it('returns null for a zero denominator rather than NaN', () => {
    expect(rate(0, 0)).toBeNull();
  });

  it('returns null for a negative denominator', () => {
    expect(rate(5, -1)).toBeNull();
  });
});

describe('formatPercent', () => {
  it('rounds to a whole percent', () => {
    expect(formatPercent(0.4604)).toBe('46%');
  });

  it('renders an em dash for an uncomputable rate', () => {
    expect(formatPercent(null)).toBe('—');
  });
});

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(4012)).toBe('4,012');
  });
});

describe('percentDelta', () => {
  it('reports growth as an increase', () => {
    expect(percentDelta(112, 100)).toEqual({ text: '+12% vs prior', direction: 'up' });
  });

  it('reports decline as a decrease, with the sign already in the text', () => {
    expect(percentDelta(92, 100)).toEqual({ text: '-8% vs prior', direction: 'down' });
  });

  it('reports flat when the change rounds to zero', () => {
    expect(percentDelta(1002, 1000)).toEqual({ text: 'flat vs prior', direction: 'flat' });
  });

  it('refuses to divide by an empty prior period', () => {
    expect(percentDelta(50, 0)).toEqual({ text: 'no prior data', direction: 'flat' });
  });
});

describe('pointsDelta', () => {
  it('reports a gain in percentage points', () => {
    expect(pointsDelta(0.46, 0.41)).toEqual({ text: '+5pts vs prior', direction: 'up' });
  });

  it('reports a loss in percentage points', () => {
    expect(pointsDelta(0.41, 0.46)).toEqual({ text: '-5pts vs prior', direction: 'down' });
  });

  it('reports flat when the gap rounds to zero points', () => {
    expect(pointsDelta(0.462, 0.458)).toEqual({ text: 'flat vs prior', direction: 'flat' });
  });

  it('refuses when either rate is uncomputable', () => {
    expect(pointsDelta(0.46, null)).toEqual({ text: 'no prior data', direction: 'flat' });
    expect(pointsDelta(null, 0.46)).toEqual({ text: 'no prior data', direction: 'flat' });
  });
});

describe('formatHours', () => {
  it('rounds to whole hours and groups thousands', () => {
    expect(formatHours(1739.6)).toBe('1,740');
  });
});

describe('formatHoursPerPerson', () => {
  it('keeps one decimal', () => {
    expect(formatHoursPerPerson(2.64)).toBe('2.6');
  });

  it('renders an em dash when the range has no fixed span', () => {
    expect(formatHoursPerPerson(null)).toBe('—');
  });
});

describe('formatUnitCost', () => {
  it('delegates to the shared analytics formatter', () => {
    expect(formatUnitCost(6.7625)).toBe('$6.76');
  });

  it('renders an em dash when nothing was put to work', () => {
    expect(formatUnitCost(null)).toBe('—');
  });
});
