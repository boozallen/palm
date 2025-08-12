import {
  generateSearchHash,
  generateCacheKey,
  generateActiveJobKey,
} from './searchHash';

describe('searchHash utils', () => {
  const baseParams = {
    dateStart: '2024-01-01',
    dateEnd: '2024-12-31',
    categories: ['AI', 'Machine Learning'],
    institutions: ['Stanford', 'MIT'],
  };

  it('should generate consistent hash for identical inputs', () => {
    const hash1 = generateSearchHash(baseParams);
    const hash2 = generateSearchHash(baseParams);
    expect(hash1).toEqual(hash2);
  });

  it('should generate same hash for categories and institutions in different order', () => {
    const reorderedParams = {
      ...baseParams,
      categories: ['Machine Learning', 'AI'],
      institutions: ['MIT', 'Stanford'],
    };

    const hash1 = generateSearchHash(baseParams);
    const hash2 = generateSearchHash(reorderedParams);
    expect(hash1).toEqual(hash2);
  });

  it('should generate different hashes when inputs differ', () => {
    const modifiedParams = {
      ...baseParams,
      dateStart: '2025-01-01',
    };

    const hash1 = generateSearchHash(baseParams);
    const hash2 = generateSearchHash(modifiedParams);
    expect(hash1).not.toEqual(hash2);
  });

  it('should normalize and ignore case and extra whitespace', () => {
    const messyParams = {
      dateStart: ' 2024-01-01 ',
      dateEnd: '2024-12-31',
      categories: ['  ai ', 'machine learning '],
      institutions: ['stanford  ', ' MIT'],
    };

    const hash1 = generateSearchHash(baseParams);
    const hash2 = generateSearchHash(messyParams);
    expect(hash1).toEqual(hash2);
  });

  it('should produce same hash for case-insensitive inputs', () => {
    const paramsUppercase = {
      dateStart: '2024-01-01',
      dateEnd: '2024-12-31',
      categories: ['AI', 'Machine Learning'],
      institutions: ['Stanford', 'MIT'],
    };

    const paramsLowercase = {
      dateStart: '2024-01-01',
      dateEnd: '2024-12-31',
      categories: ['ai', 'machine learning'],
      institutions: ['stanford', 'mit'],
    };

    const hash1 = generateSearchHash(paramsUppercase);
    const hash2 = generateSearchHash(paramsLowercase);
    expect(hash1).toEqual(hash2);
  });

  it('should generate correct cache key', () => {
    const dummyHash = 'abc123';
    const cacheKey = generateCacheKey(dummyHash);
    expect(cacheKey).toEqual('research-cache:abc123');
  });

  it('should generate correct active job key', () => {
    const dummyHash = 'xyz789';
    const activeJobKey = generateActiveJobKey(dummyHash);
    expect(activeJobKey).toEqual('research-active:xyz789');
  });
});
