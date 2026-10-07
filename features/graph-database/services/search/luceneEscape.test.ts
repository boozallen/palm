import { luceneEscape, buildLuceneOrQuery } from './luceneEscape';

describe('luceneEscape', () => {
  it('escapes Lucene special characters', () => {
    expect(luceneEscape('hello+world')).toBe('hello\\+world');
    expect(luceneEscape('foo(bar)')).toBe('foo\\(bar\\)');
    expect(luceneEscape('EU AI Act')).toBe('EU AI Act');
  });

  it('returns unchanged string with no special chars', () => {
    expect(luceneEscape('John Smith')).toBe('John Smith');
  });

  it('escapes colons', () => {
    expect(luceneEscape('key:value')).toBe('key\\:value');
  });

  it('escapes square brackets', () => {
    expect(luceneEscape('[test]')).toBe('\\[test\\]');
  });

  it('escapes double ampersand', () => {
    expect(luceneEscape('a&&b')).toBe('a\\&&b');
  });

  it('escapes pipe pipe', () => {
    expect(luceneEscape('a||b')).toBe('a\\||b');
  });
});

describe('buildLuceneOrQuery', () => {
  it('quotes multi-word terms', () => {
    expect(buildLuceneOrQuery(['EU AI Act'])).toBe('"EU AI Act"');
  });

  it('leaves single tokens bare', () => {
    expect(buildLuceneOrQuery(['ASI'])).toBe('ASI');
  });

  it('joins multiple terms with OR', () => {
    expect(buildLuceneOrQuery(['ASI', 'EU AI Act'])).toBe('ASI OR "EU AI Act"');
  });

  it('returns * for empty terms', () => {
    expect(buildLuceneOrQuery([])).toBe('*');
  });

  it('filters out whitespace-only terms', () => {
    expect(buildLuceneOrQuery(['  ', 'ASI'])).toBe('ASI');
  });

  it('returns * when all terms are whitespace', () => {
    expect(buildLuceneOrQuery(['  ', ''])).toBe('*');
  });
});
