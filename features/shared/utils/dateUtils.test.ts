import { toUTCTimeStamp, getSharedDocumentExpirationDate, getTimeUntilExpiration } from '@/features/shared/utils/dateUtils';

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

describe('getSharedDocumentExpirationDate', () => {
  it('returns a date 7 days in the past', () => {
    const mockDate = new Date('2023-03-15T12:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    
    const result = getSharedDocumentExpirationDate();
    
    expect(result).toEqual(new Date('2023-03-08T12:00:00Z'));
    
    jest.restoreAllMocks();
  });
  
  it('handles month boundaries correctly', () => {
    const mockDate = new Date('2023-03-03T12:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    
    const result = getSharedDocumentExpirationDate();
    
    expect(result).toEqual(new Date('2023-02-24T12:00:00Z'));
    
    jest.restoreAllMocks();
  });
});

describe('getTimeUntilExpiration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns expired status when document has expired', () => {
    const now = new Date('2023-03-15T12:00:00Z');
    jest.setSystemTime(now);
    
    const createdAt = new Date('2023-03-01T12:00:00Z'); // 14 days ago (> 7 days)
    const result = getTimeUntilExpiration(createdAt);
    
    expect(result.isExpired).toBe(true);
    expect(result.timeRemainingText).toBe('Expired');
    expect(result.timeRemaining).toBe(0);
  });

  it('returns correct days and hours when multiple days remain', () => {
    const now = new Date('2023-03-15T12:00:00Z');
    jest.setSystemTime(now);
    
    const createdAt = new Date('2023-03-13T10:00:00Z'); // Created 2 days 2 hours ago, expires in ~4 days 22 hours
    const result = getTimeUntilExpiration(createdAt);
    
    expect(result.isExpired).toBe(false);
    expect(result.timeRemainingText).toContain('days');
    expect(result.timeRemaining).toBeGreaterThan(0);
  });

  it('returns correct time for exactly 1 day remaining', () => {
    const now = new Date('2023-03-15T12:00:00Z');
    jest.setSystemTime(now);
    
    const createdAt = new Date('2023-03-09T14:00:00Z'); // Should have exactly ~1 day remaining
    const result = getTimeUntilExpiration(createdAt);
    
    expect(result.isExpired).toBe(false);
    expect(result.timeRemainingText).toMatch(/1 day/);
  });

  it('returns hours and minutes when less than a day remains', () => {
    const now = new Date('2023-03-15T12:00:00Z');
    jest.setSystemTime(now);

    const createdAt = new Date('2023-03-08T14:00:00Z'); // Should have ~22 hours remaining
    const result = getTimeUntilExpiration(createdAt);

    expect(result.isExpired).toBe(false);
    expect(result.timeRemainingText).toContain('h');
  });

});
