import { endOfCodePoint, startOfCodePoint } from '@/features/shared/utils/surrogatePairs';

describe('surrogatePairs', () => {
  // 'A😀B' is four UTF-16 code units: A, high surrogate, low surrogate, B.
  const text = 'A😀B';

  describe('startOfCodePoint', () => {
    it('moves an index on the low surrogate back to the high surrogate', () => {
      expect(startOfCodePoint(text, 2)).toBe(1);
    });

    it.each([
      ['the start of the string', 0],
      ['a high surrogate', 1],
      ['a plain character', 3],
      ['the end of the string', 4],
    ])('leaves an index on %s alone', (_label, index) => {
      expect(startOfCodePoint(text, index)).toBe(index);
    });
  });

  describe('endOfCodePoint', () => {
    it('moves an end that would split a pair to just past the pair', () => {
      expect(endOfCodePoint(text, 2)).toBe(3);
    });

    it.each([
      ['the start of the string', 0],
      ['just after a plain character', 1],
      ['just after a complete pair', 3],
      ['the end of the string', 4],
      ['past the end of the string', 9],
    ])('leaves an end at %s alone', (_label, index) => {
      expect(endOfCodePoint(text, index)).toBe(index);
    });
  });

  it('never yields a slice that ends or starts on half a pair', () => {
    const content = 'x😀y😀z';
    for (let start = 0; start <= content.length; start += 1) {
      for (let end = start; end <= content.length; end += 1) {
        const slice = content.slice(startOfCodePoint(content, start), endOfCodePoint(content, end));
        expect(slice).not.toMatch(/^[\udc00-\udfff]/);
        expect(slice).not.toMatch(/[\ud800-\udbff]$/);
      }
    }
  });
});
