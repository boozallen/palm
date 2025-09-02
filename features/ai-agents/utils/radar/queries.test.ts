import { createDateQuery, createCategoryQuery } from '@/features/ai-agents/utils/radar/queries';

describe('createDateQuery', () => {
  it('returns a valid arXiv date query for given ISO dates', () => {
    const start = '2023-05-01T10:30:00Z';
    const end = '2023-05-10T15:45:00Z';

    const expected = '(submittedDate:[202305011030 TO 202305101545])';
    const result = createDateQuery(start, end);

    expect(result).toBe(expected);
  });
});

describe('createCategoryQuery', () => {
  it('returns null if given an empty category list', () => {
    expect(createCategoryQuery([])).toBeNull();
  });

  it('returns a single category query correctly', () => {
    const result = createCategoryQuery(['cs.AI']);
    expect(result).toBe('(cat:cs.AI)');
  });

  it('returns a joined category query for multiple categories', () => {
    const result = createCategoryQuery(['cs.AI', 'cs.CL']);
    expect(result).toBe('(cat:cs.AI OR cat:cs.CL)');
  });

  it('removes duplicate categories before generating query', () => {
    const result = createCategoryQuery(['cs.AI', 'cs.AI', 'cs.CL']);
    expect(result).toBe('(cat:cs.AI OR cat:cs.CL)');
  });

  it('preserves order for unique categories', () => {
    const result = createCategoryQuery(['cs.CL', 'cs.AI']);
    expect(result).toBe('(cat:cs.CL OR cat:cs.AI)');
  });
});
