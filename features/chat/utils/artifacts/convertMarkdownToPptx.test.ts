import PptxGenJS from 'pptxgenjs';

import { convertMarkdownToPptx } from './convertMarkdownToPptx';

jest.mock('pptxgenjs');

const mockAddText = jest.fn();
const mockAddTable = jest.fn();
const mockAddSlide = jest.fn(() => ({
  addText: mockAddText,
  addTable: mockAddTable,
}));
const mockWrite = jest.fn(() => Promise.resolve(new ArrayBuffer(100)));
const mockDefineLayout = jest.fn();

(PptxGenJS as unknown as jest.Mock).mockImplementation(() => ({
  addSlide: mockAddSlide,
  write: mockWrite,
  defineLayout: mockDefineLayout,
  layout: '',
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('convertMarkdownToPptx', () => {
  it('should return a Blob with the correct MIME type', async () => {
    const markdown = `# Title

## Slide One

Some text.`;

    const blob = await convertMarkdownToPptx(markdown);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
  });

  it('should create a title slide for the first h1', async () => {
    const markdown = '# My Presentation';

    await convertMarkdownToPptx(markdown);

    expect(mockAddSlide).toHaveBeenCalledTimes(1);
    expect(mockAddText).toHaveBeenCalledWith(
      'My Presentation',
      expect.objectContaining({
        fontSize: 36,
        bold: true,
        align: 'center',
      }),
    );
  });

  it('should split slides on h2 headings', async () => {
    const markdown = `# Title

## Slide One

Text on slide one.

## Slide Two

Text on slide two.`;

    await convertMarkdownToPptx(markdown);

    // Title slide + Slide One + Slide Two = 3 slides
    expect(mockAddSlide).toHaveBeenCalledTimes(3);
  });

  it('should handle empty content with a fallback slide', async () => {
    await convertMarkdownToPptx('');

    expect(mockAddSlide).toHaveBeenCalledTimes(1);
    expect(mockAddText).toHaveBeenCalledWith(
      'Empty Presentation',
      expect.objectContaining({
        fontSize: 28,
        align: 'center',
      }),
    );
  });

  it('should handle plain text without headings as a single slide', async () => {
    await convertMarkdownToPptx('Just some plain text.');

    expect(mockAddSlide).toHaveBeenCalledTimes(1);
    expect(mockAddText).toHaveBeenCalled();
  });

  it('should render list items with bullet formatting', async () => {
    const markdown = `## List Slide

- Item one
- Item two`;

    await convertMarkdownToPptx(markdown);

    expect(mockAddSlide).toHaveBeenCalledTimes(1);

    // List items are rendered as addText calls with bullet options
    const bulletCalls = mockAddText.mock.calls.filter(
      (call: unknown[]) =>
        Array.isArray(call[0]) &&
        call[0][0]?.options?.bullet,
    );
    expect(bulletCalls.length).toBeGreaterThan(0);
    expect(bulletCalls[0][0][0].text).toBe('Item one');
  });

  it('should render h2 heading text on the slide', async () => {
    const markdown = `## My Slide Title

Some body text.`;

    await convertMarkdownToPptx(markdown);

    expect(mockAddText).toHaveBeenCalledWith(
      'My Slide Title',
      expect.objectContaining({
        fontSize: 28,
        bold: true,
      }),
    );
  });

  it('should render paragraph text on the slide', async () => {
    const markdown = `## Slide

Hello world paragraph.`;

    await convertMarkdownToPptx(markdown);

    const paragraphCall = mockAddText.mock.calls.find(
      (call: unknown[]) =>
        Array.isArray(call[0]) &&
        call[0].some(
          (p: PptxGenJS.TextProps) =>
            typeof p.text === 'string' && p.text.includes('Hello world'),
        ),
    );
    expect(paragraphCall).toBeDefined();
  });

  it('should render bold text with bold option', async () => {
    const markdown = `## Formatting

This has **bold** text.`;

    await convertMarkdownToPptx(markdown);

    const paragraphCall = mockAddText.mock.calls.find(
      (call: unknown[]) =>
        Array.isArray(call[0]) &&
        call[0].some((p: PptxGenJS.TextProps) => p.options?.bold === true),
    );
    expect(paragraphCall).toBeDefined();
    const boldPart = paragraphCall[0].find(
      (p: PptxGenJS.TextProps) => p.options?.bold === true,
    );
    expect(boldPart.text).toBe('bold');
  });

  it('should render italic text with italic option', async () => {
    const markdown = `## Formatting

This has *italic* text.`;

    await convertMarkdownToPptx(markdown);

    const paragraphCall = mockAddText.mock.calls.find(
      (call: unknown[]) =>
        Array.isArray(call[0]) &&
        call[0].some((p: PptxGenJS.TextProps) => p.options?.italic === true),
    );
    expect(paragraphCall).toBeDefined();
    const italicPart = paragraphCall[0].find(
      (p: PptxGenJS.TextProps) => p.options?.italic === true,
    );
    expect(italicPart.text).toBe('italic');
  });

  it('should handle h3 headings within a slide without splitting', async () => {
    const markdown = `## Main Slide

### Sub-section

Some content.`;

    await convertMarkdownToPptx(markdown);

    // h3 does NOT split into a new slide
    expect(mockAddSlide).toHaveBeenCalledTimes(1);
  });

  it('should call pptx.write with arraybuffer output type', async () => {
    await convertMarkdownToPptx('# Test');

    expect(mockWrite).toHaveBeenCalledWith({ outputType: 'arraybuffer' });
  });

  it('should define a wide layout', async () => {
    await convertMarkdownToPptx('# Test');

    expect(mockDefineLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'WIDE',
        width: 13.33,
        height: 7.5,
      }),
    );
  });

  it('should handle multiple h2 slides with content', async () => {
    const markdown = `## First

Content one.

## Second

Content two.

## Third

Content three.`;

    await convertMarkdownToPptx(markdown);

    expect(mockAddSlide).toHaveBeenCalledTimes(3);
  });

  it('should handle only h1 with no other content', async () => {
    await convertMarkdownToPptx('# Solo Title');

    expect(mockAddSlide).toHaveBeenCalledTimes(1);
    expect(mockAddText).toHaveBeenCalledWith(
      'Solo Title',
      expect.objectContaining({ align: 'center' }),
    );
  });

  it('should handle multiple content types on one slide', async () => {
    const markdown = `## Mixed Slide

A paragraph.

- List item

Another paragraph.`;

    await convertMarkdownToPptx(markdown);

    expect(mockAddSlide).toHaveBeenCalledTimes(1);
    // Should have multiple addText calls (heading + paragraph + list + paragraph)
    expect(mockAddText.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('should not produce extra slides for h3/h4 headings', async () => {
    const markdown = `## Slide

### Section A

#### Subsection

Content here.`;

    await convertMarkdownToPptx(markdown);

    expect(mockAddSlide).toHaveBeenCalledTimes(1);
  });

  it('should treat second h1 as a regular heading, not title', async () => {
    const markdown = `# Title

# Second Heading`;

    await convertMarkdownToPptx(markdown);

    // First h1 = title slide, second h1 splits into new slide
    expect(mockAddSlide).toHaveBeenCalledTimes(2);

    // First call should be title (centered)
    expect(mockAddText.mock.calls[0][1]).toEqual(
      expect.objectContaining({ align: 'center', fontSize: 36 }),
    );
    // Second call should be regular heading (not centered)
    expect(mockAddText.mock.calls[1][1]).not.toEqual(
      expect.objectContaining({ align: 'center' }),
    );
  });
});
