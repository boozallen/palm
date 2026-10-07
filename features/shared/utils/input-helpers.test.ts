import {
  parseNumber,
  formatCurrencyNumber,
  formatCurrencyNumberForAnalytics,
  formatTokenCount,
  calculateTokenCost,
} from './input-helpers';

describe('parseNumber', () => {
  it('should remove non-numeric characters from the string', () => {
    expect(parseNumber('$1,000')).toBe('1000');
    expect(parseNumber('$10')).toBe('10');
    expect(parseNumber('1,234,567')).toBe('1234567');
    expect(parseNumber('abc123')).toBe('123');
    expect(parseNumber('1.23')).toBe('1.23');
  });

  it('should return an empty string if the input is not a valid number', () => {
    expect(parseNumber('')).toBe('');
    expect(parseNumber('abc')).toBe('');
    expect(parseNumber('!@#$%^&*()<>?:";[]/{}|')).toBe('');
  });
});

describe('formatCurrencyNumber', () => {
  it('should format the number with commas', () => {
    expect(formatCurrencyNumber('1000')).toBe('1,000.00');
    expect(formatCurrencyNumber('1000000')).toBe('1,000,000.00');
    expect(formatCurrencyNumber('123456789')).toBe('123,456,789.00');
    expect(formatCurrencyNumber('1234567890.000000')).toBe('1,234,567,890.00');
  });

  it('should return an empty string if the input is not a valid number', () => {
    expect(formatCurrencyNumber('')).toBe('');
    expect(formatCurrencyNumber('abc')).toBe('');
  });
});

describe('formatCurrencyNumberForAnalytics', () => {
  it('should format numbers with dollar sign and two decimal places', () => {
    expect(formatCurrencyNumberForAnalytics(1000)).toBe('$1,000.00');
    expect(formatCurrencyNumberForAnalytics(1000000)).toBe('$1,000,000.00');
    expect(formatCurrencyNumberForAnalytics(123456.789)).toBe('$123,456.79');
    expect(formatCurrencyNumberForAnalytics(0.5)).toBe('$0.50');
  });

  it('should return "<$0.01" for values greater than 0 but less than 0.01', () => {
    expect(formatCurrencyNumberForAnalytics(0.001)).toBe('<$0.01');
    expect(formatCurrencyNumberForAnalytics(0.005)).toBe('<$0.01');
    expect(formatCurrencyNumberForAnalytics(0.009)).toBe('<$0.01');
  });

  it('should format zero correctly', () => {
    expect(formatCurrencyNumberForAnalytics(0)).toBe('$0.00');
  });

  it('should format negative numbers correctly', () => {
    expect(formatCurrencyNumberForAnalytics(-100)).toBe('$-100.00');
    expect(formatCurrencyNumberForAnalytics(-1000.50)).toBe('$-1,000.50');
  });

  it('should handle edge case at exactly 0.01', () => {
    expect(formatCurrencyNumberForAnalytics(0.01)).toBe('$0.01');
  });
});

describe('formatTokenCount', () => {
  it('should format numbers less than 1000 with locale formatting', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(1)).toBe('1');
    expect(formatTokenCount(100)).toBe('100');
    expect(formatTokenCount(999)).toBe('999');
  });

  it('should format numbers in thousands with K suffix', () => {
    expect(formatTokenCount(1000)).toBe('1.0K');
    expect(formatTokenCount(1500)).toBe('1.5K');
    expect(formatTokenCount(10000)).toBe('10.0K');
    expect(formatTokenCount(125000)).toBe('125.0K');
    expect(formatTokenCount(999999)).toBe('1000.0K');
  });

  it('should format numbers in millions with M suffix', () => {
    expect(formatTokenCount(1000000)).toBe('1.0M');
    expect(formatTokenCount(1500000)).toBe('1.5M');
    expect(formatTokenCount(10000000)).toBe('10.0M');
    expect(formatTokenCount(123456789)).toBe('123.5M');
  });

  it('should round to one decimal place', () => {
    expect(formatTokenCount(1234)).toBe('1.2K');
    expect(formatTokenCount(1567)).toBe('1.6K');
    expect(formatTokenCount(1234567)).toBe('1.2M');
    expect(formatTokenCount(1567890)).toBe('1.6M');
  });
});

describe('calculateTokenCost', () => {
  it('should calculate cost correctly for input tokens with cost per 1M tokens', () => {
    // Example: 664,000 tokens at $5.50 per 1M tokens
    expect(calculateTokenCost(664000, 5.50)).toBeCloseTo(3.652, 2);
    // Example: 1,000,000 tokens at $10 per 1M tokens
    expect(calculateTokenCost(1000000, 10)).toBe(10);
    // Example: 500,000 tokens at $20 per 1M tokens
    expect(calculateTokenCost(500000, 20)).toBe(10);
  });

  it('should return 0 when cost per token is undefined', () => {
    expect(calculateTokenCost(100000, undefined)).toBe(0);
  });

  it('should return 0 when tokens is 0', () => {
    expect(calculateTokenCost(0, 5.50)).toBe(0);
  });

  it('should handle small token counts', () => {
    // Example: 1,000 tokens at $5 per 1M tokens
    expect(calculateTokenCost(1000, 5)).toBe(0.005);
    // Example: 100 tokens at $10 per 1M tokens
    expect(calculateTokenCost(100, 10)).toBe(0.001);
  });

  it('should handle large token counts', () => {
    // Example: 10M tokens at $15 per 1M tokens
    expect(calculateTokenCost(10000000, 15)).toBe(150);
    // Example: 89.3M tokens at $22 per 1M tokens
    expect(calculateTokenCost(89300000, 22)).toBeCloseTo(1964.6, 1);
  });

  it('should handle decimal cost per token values', () => {
    // Example: 100,000 tokens at $0.50 per 1M tokens
    expect(calculateTokenCost(100000, 0.50)).toBe(0.05);
  });
});
