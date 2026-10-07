import { ExternalHyperlink, TextRun } from 'docx';
import type { PhrasingContent } from 'mdast';
import { convertMarkdownToDocx, convertInlineNode } from './convertMarkdownToDocx';

/**
 * Extracts formatting properties from a TextRun by inspecting its XML structure.
 * Returns an object with the text content and boolean formatting flags.
 */
function getTextRunProps(run: TextRun | ExternalHyperlink): { text: string; bold: boolean; italics: boolean; strike: boolean } {
  const json = JSON.stringify(run);
  const textMatch = json.match(/"w:t".*?\[.*?"([^"]*?)"\s*\]/);
  return {
    text: textMatch ? textMatch[1] : '',
    bold: json.includes('"w:b"'),
    italics: json.includes('"w:i"'),
    strike: json.includes('"w:strike"'),
  };
}

describe('convertMarkdownToDocx', () => {
  it('should convert markdown to a Word document blob', async () => {
    const markdown = `# Main Heading

This is a paragraph with some text.

## Subheading

- Bullet point 1
- Bullet point 2

### Another Heading

This paragraph has **bold text** and *italic text*.

1. Numbered item 1
2. Numbered item 2`;

    const blob = await convertMarkdownToDocx(markdown);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle plain text without formatting', async () => {
    const plainText = 'This is just plain text without any markdown formatting.';

    const blob = await convertMarkdownToDocx(plainText);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle empty content', async () => {
    const emptyContent = '';

    const blob = await convertMarkdownToDocx(emptyContent);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle content with only headings', async () => {
    const headingsOnly = `# Heading 1
## Heading 2
### Heading 3`;

    const blob = await convertMarkdownToDocx(headingsOnly);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle content with only lists', async () => {
    const listsOnly = `- Item 1
- Item 2
- Item 3

1. Numbered 1
2. Numbered 2
3. Numbered 3`;

    const blob = await convertMarkdownToDocx(listsOnly);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle content with clickable links', async () => {
    const markdownWithLinks = `Check out [Example](https://example.com) for more info.

[Another link](https://another.com)`;

    const blob = await convertMarkdownToDocx(markdownWithLinks);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle mixed bold and italic formatting', async () => {
    const mixedFormatting = 'This has **bold**, *italic*, and **bold with *nested italic*** text.';

    const blob = await convertMarkdownToDocx(mixedFormatting);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('convertInlineNode', () => {
  it('should produce a plain TextRun for a text node', () => {
    const node: PhrasingContent = { type: 'text', value: 'hello' };
    const runs = convertInlineNode(node);

    expect(runs).toHaveLength(1);
    const props = getTextRunProps(runs[0]);
    expect(props.text).toBe('hello');
    expect(props.bold).toBe(false);
    expect(props.italics).toBe(false);
    expect(props.strike).toBe(false);
  });

  it('should produce a bold TextRun for a strong node', () => {
    const node: PhrasingContent = {
      type: 'strong',
      children: [{ type: 'text', value: 'bold' }],
    };
    const runs = convertInlineNode(node);

    expect(runs).toHaveLength(1);
    const props = getTextRunProps(runs[0]);
    expect(props.text).toBe('bold');
    expect(props.bold).toBe(true);
    expect(props.italics).toBe(false);
  });

  it('should produce an italic TextRun for an emphasis node', () => {
    const node: PhrasingContent = {
      type: 'emphasis',
      children: [{ type: 'text', value: 'italic' }],
    };
    const runs = convertInlineNode(node);

    expect(runs).toHaveLength(1);
    const props = getTextRunProps(runs[0]);
    expect(props.text).toBe('italic');
    expect(props.bold).toBe(false);
    expect(props.italics).toBe(true);
  });

  it('should produce a strikethrough TextRun for a delete node', () => {
    const node: PhrasingContent = {
      type: 'delete',
      children: [{ type: 'text', value: 'struck' }],
    };
    const runs = convertInlineNode(node);

    expect(runs).toHaveLength(1);
    const props = getTextRunProps(runs[0]);
    expect(props.text).toBe('struck');
    expect(props.strike).toBe(true);
  });

  it('should propagate bold into nested emphasis (bold + italic)', () => {
    // Represents: **bold *and italic***
    const node: PhrasingContent = {
      type: 'strong',
      children: [
        { type: 'text', value: 'bold ' },
        {
          type: 'emphasis',
          children: [{ type: 'text', value: 'and italic' }],
        },
      ],
    };
    const runs = convertInlineNode(node);

    expect(runs).toHaveLength(2);

    const boldOnly = getTextRunProps(runs[0]);
    expect(boldOnly.text).toBe('bold ');
    expect(boldOnly.bold).toBe(true);
    expect(boldOnly.italics).toBe(false);

    const boldAndItalic = getTextRunProps(runs[1]);
    expect(boldAndItalic.text).toBe('and italic');
    expect(boldAndItalic.bold).toBe(true);
    expect(boldAndItalic.italics).toBe(true);
  });

  it('should propagate italic into nested strong (italic + bold)', () => {
    // Represents: *italic **and bold***
    const node: PhrasingContent = {
      type: 'emphasis',
      children: [
        { type: 'text', value: 'italic ' },
        {
          type: 'strong',
          children: [{ type: 'text', value: 'and bold' }],
        },
      ],
    };
    const runs = convertInlineNode(node);

    expect(runs).toHaveLength(2);

    const italicOnly = getTextRunProps(runs[0]);
    expect(italicOnly.text).toBe('italic ');
    expect(italicOnly.bold).toBe(false);
    expect(italicOnly.italics).toBe(true);

    const italicAndBold = getTextRunProps(runs[1]);
    expect(italicAndBold.text).toBe('and bold');
    expect(italicAndBold.bold).toBe(true);
    expect(italicAndBold.italics).toBe(true);
  });

  it('should propagate formatting through triple nesting (bold + italic + strikethrough)', () => {
    // Represents: **bold *italic ~~and struck~~***
    const node: PhrasingContent = {
      type: 'strong',
      children: [
        {
          type: 'emphasis',
          children: [
            { type: 'text', value: 'italic ' },
            {
              type: 'delete',
              children: [{ type: 'text', value: 'and struck' }],
            },
          ],
        },
      ],
    };
    const runs = convertInlineNode(node);

    expect(runs).toHaveLength(2);

    const boldItalic = getTextRunProps(runs[0]);
    expect(boldItalic.text).toBe('italic ');
    expect(boldItalic.bold).toBe(true);
    expect(boldItalic.italics).toBe(true);
    expect(boldItalic.strike).toBe(false);

    const allThree = getTextRunProps(runs[1]);
    expect(allThree.text).toBe('and struck');
    expect(allThree.bold).toBe(true);
    expect(allThree.italics).toBe(true);
    expect(allThree.strike).toBe(true);
  });

  it('should apply parent formatting passed via the formatting parameter', () => {
    const node: PhrasingContent = { type: 'text', value: 'blockquote text' };
    const runs = convertInlineNode(node, { italic: true });

    expect(runs).toHaveLength(1);
    const props = getTextRunProps(runs[0]);
    expect(props.text).toBe('blockquote text');
    expect(props.italics).toBe(true);
  });

  it('should produce an ExternalHyperlink for a link node', () => {
    const node: PhrasingContent = {
      type: 'link',
      url: 'https://example.com',
      children: [{ type: 'text', value: 'Click here' }],
    };
    const runs = convertInlineNode(node);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toBeInstanceOf(ExternalHyperlink);

    const json = JSON.stringify(runs[0]);
    expect(json).toContain('https://example.com');
    expect(json).toContain('Click here');
  });

  it('should merge parent formatting with node formatting', () => {
    // Simulates bold text inside a blockquote (italic parent formatting)
    const node: PhrasingContent = {
      type: 'strong',
      children: [{ type: 'text', value: 'bold in blockquote' }],
    };
    const runs = convertInlineNode(node, { italic: true });

    expect(runs).toHaveLength(1);
    const props = getTextRunProps(runs[0]);
    expect(props.text).toBe('bold in blockquote');
    expect(props.bold).toBe(true);
    expect(props.italics).toBe(true);
  });
});
