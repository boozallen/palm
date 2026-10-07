import { PrimitiveType } from '@/features/workflows/types/primitive';
import { getNodeDef } from '@/features/workflows/utils/node-registry';

import { getPrimitiveLabel, isCompleteHTMLDocument, stripMarkdownCodeFence } from './primitive-helpers';

jest.mock('@/features/workflows/utils/node-registry');

describe('primitive-helpers', () => {
  describe('getPrimitiveLabel', () => {
    it('returns the label from the node definition', () => {
      (getNodeDef as jest.Mock).mockReturnValue({ label: 'Prompt' });

      expect(getPrimitiveLabel(PrimitiveType.PROMPT)).toBe('Prompt');
      expect(getNodeDef).toHaveBeenCalledWith(PrimitiveType.PROMPT);
    });
  });

  describe('isCompleteHTMLDocument', () => {
    it('returns true for a string starting with <!DOCTYPE html', () => {
      expect(isCompleteHTMLDocument('<!DOCTYPE html><html><body></body></html>')).toBe(true);
    });

    it('returns true for a string starting with <html', () => {
      expect(isCompleteHTMLDocument('<html><body></body></html>')).toBe(true);
    });

    it('returns true when there is leading whitespace', () => {
      expect(isCompleteHTMLDocument('  \n <!DOCTYPE html><html></html>')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isCompleteHTMLDocument('<!doctype HTML><html></html>')).toBe(true);
      expect(isCompleteHTMLDocument('<HTML><body></body></HTML>')).toBe(true);
    });

    it('returns false for a plain string', () => {
      expect(isCompleteHTMLDocument('Hello world')).toBe(false);
    });

    it('returns false for an HTML fragment', () => {
      expect(isCompleteHTMLDocument('<div>Some content</div>')).toBe(false);
    });

    it('returns false for markdown containing html keyword', () => {
      expect(isCompleteHTMLDocument('# HTML Guide\nSome content')).toBe(false);
    });
  });

  describe('stripMarkdownCodeFence', () => {
    it('extracts HTML from between code fences', () => {
      const wrapped = '```html\n<!DOCTYPE html><html><body></body></html>\n```';
      const expected = '<!DOCTYPE html><html><body></body></html>';
      expect(stripMarkdownCodeFence(wrapped)).toBe(expected);
    });

    it('extracts HTML without language specifier', () => {
      const wrapped = '```\n<html><body>Content</body></html>\n```';
      const expected = '<html><body>Content</body></html>';
      expect(stripMarkdownCodeFence(wrapped)).toBe(expected);
    });

    it('handles different language specifiers case-insensitively', () => {
      const wrapped = '```HTML\n<html></html>\n```';
      const expected = '<html></html>';
      expect(stripMarkdownCodeFence(wrapped)).toBe(expected);
    });

    it('returns complete HTML unchanged if no code fences', () => {
      const content = '<!DOCTYPE html><html><body></body></html>';
      expect(stripMarkdownCodeFence(content)).toBe(content);
    });

    it('extracts HTML and ignores text after closing fence', () => {
      const wrapped = '```html\n<!DOCTYPE html><html><body><h1>Test</h1></body></html>\n```\n\nThis is additional explanatory text that should be ignored.';
      const expected = '<!DOCTYPE html><html><body><h1>Test</h1></body></html>';
      expect(stripMarkdownCodeFence(wrapped)).toBe(expected);
    });

    it('extracts HTML and ignores multi-line text after closing fence', () => {
      const wrapped = `\`\`\`html
<!DOCTYPE html><html><body>Content</body></html>
\`\`\`

This complete HTML page includes:
- Feature 1
- Feature 2`;
      const expected = '<!DOCTYPE html><html><body>Content</body></html>';
      expect(stripMarkdownCodeFence(wrapped)).toBe(expected);
    });

    it('handles HTML starting with <html> tag', () => {
      const wrapped = '```html\n<html><body></body></html>\n```\n\nExtra text';
      const expected = '<html><body></body></html>';
      expect(stripMarkdownCodeFence(wrapped)).toBe(expected);
    });

    it('returns plain text unchanged if no valid pattern found', () => {
      const text = 'Just some plain text';
      expect(stripMarkdownCodeFence(text)).toBe(text);
    });
  });
});
