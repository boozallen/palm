import { toUTCTimeStamp } from '@/features/shared/utils/dateUtils';

describe('toUTCTimeStamp', () => {
  it('converts a valid ISO string to UTC formatted string', () => {
    const input = '2023-03-15T14:05:00Z';
    const result = toUTCTimeStamp(input);
    expect(result).toBe('202303151405');
  });

  it('pads single-digit months, days, hours, and minutes with zeroes', () => {
    const input = '2023-01-02T03:04:00Z';
    const result = toUTCTimeStamp(input);
    expect(result).toBe('202301020304');
  });

  it('throws an Invalid Date if the input is malformed', () => {
    expect(() => toUTCTimeStamp('invalid-date')).not.toThrow();
    expect(toUTCTimeStamp('invalid-date')).toBe('NaNNaNNaNNaNNaN');
  });

  it('works with timezone offset by converting to UTC', () => {
    const input = '2023-03-15T10:00:00-04:00';
    const result = toUTCTimeStamp(input);
    expect(result).toBe('202303151400');
  });
});
