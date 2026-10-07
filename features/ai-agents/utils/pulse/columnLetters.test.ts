import {
  formatColumnLabel,
  formatColumnLetters,
  isColumnLetter,
} from '@/features/ai-agents/utils/pulse/columnLetters';

describe('isColumnLetter', () => {
  it('accepts one to three letters in either case', () => {
    expect(isColumnLetter('B')).toBe(true);
    expect(isColumnLetter('aa')).toBe(true);
    expect(isColumnLetter('XFD')).toBe(true);
  });

  it('rejects numbers, punctuation, and longer words', () => {
    expect(isColumnLetter('3')).toBe(false);
    expect(isColumnLetter('C!')).toBe(false);
    expect(isColumnLetter('Region')).toBe(false);
    expect(isColumnLetter('')).toBe(false);
  });
});

describe('formatColumnLetters', () => {
  it('joins for display in a text input', () => {
    expect(formatColumnLetters(['B', 'C'])).toBe('B, C');
  });

  it('returns an empty string for no columns', () => {
    expect(formatColumnLetters([])).toBe('');
  });
});

describe('formatColumnLabel', () => {
  it('joins the letter and the header with an en dash', () => {
    expect(formatColumnLabel('C', 'Revenue')).toBe('C – Revenue');
  });

  it('collapses the whitespace inside a header', () => {
    expect(formatColumnLabel('D', '  How did\n  we do? ')).toBe('D – How did we do?');
  });

  it('shows the letter alone when the header is blank', () => {
    expect(formatColumnLabel('E', '   ')).toBe('E');
  });
});
