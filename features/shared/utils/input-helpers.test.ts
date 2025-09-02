import { parseNumber, formatCurrencyNumber } from './input-helpers';

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
