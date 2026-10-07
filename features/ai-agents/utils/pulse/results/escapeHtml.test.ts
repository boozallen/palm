import escapeHtml from '@/features/ai-agents/utils/pulse/results/escapeHtml';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('<a href="x">Tom & Jerry\'s</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });

  it('leaves plain text, en dashes, and ellipses unchanged', () => {
    expect(escapeHtml('C – Revenue…')).toBe('C – Revenue…');
  });

  it('escapes an ampersand only once', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});
