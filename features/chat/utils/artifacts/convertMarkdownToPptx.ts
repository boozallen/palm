import PptxGenJS from 'pptxgenjs';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

import type { Root, RootContent, PhrasingContent, TableRow as MdastTableRow } from 'mdast';
import { toString } from 'mdast-util-to-string';

const THEME = {
  background: 'FFFFFF',
  title: '1F2937',
  body: '374151',
  accent: '2563EB',
  tableBorder: 'D1D5DB',
  tableHeader: 'EFF6FF',
  tableHeaderText: '1E40AF',
  codeBackground: 'F3F4F6',
  codeText: '1F2937',
  subtleText: '6B7280',
};

const FONT = {
  heading: 'Calibri',
  body: 'Calibri',
  code: 'Courier New',
};

type SlideContent = {
  type: 'title';
  text: string;
} | {
  type: 'heading';
  text: string;
  level: number;
} | {
  type: 'paragraph';
  children: PhrasingContent[];
} | {
  type: 'list';
  ordered: boolean;
  items: string[];
} | {
  type: 'table';
  headers: string[];
  rows: string[][];
} | {
  type: 'code';
  value: string;
  lang?: string;
};

/**
 * Converts markdown content to a PowerPoint presentation blob.
 *
 * Parses markdown into an AST, groups content into slides by headings,
 * and renders each slide with appropriate formatting.
 */
export async function convertMarkdownToPptx(content: string): Promise<Blob> {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(content);

  const slides = groupContentIntoSlides(tree);
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';

  for (const slideContent of slides) {
    renderSlide(pptx, slideContent);
  }

  // Ensure at least one slide exists
  if (slides.length === 0) {
    const slide = pptx.addSlide();
    slide.addText('Empty Presentation', {
      x: 0.5,
      y: 2.5,
      w: 12.33,
      fontSize: 28,
      color: THEME.body,
      fontFace: FONT.heading,
      align: 'center',
    });
  }

  const output = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;

  return new Blob([output], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

/**
 * Groups AST nodes into logical slides, splitting on top-level headings.
 * The first heading becomes the title slide.
 */
function groupContentIntoSlides(tree: Root): SlideContent[][] {
  const slides: SlideContent[][] = [];
  let currentSlide: SlideContent[] = [];
  let isFirstHeading = true;

  for (const node of tree.children) {
    const items = convertNodeToSlideContent(node);

    for (const item of items) {
      if (item.type === 'heading' && item.level <= 2) {
        // Start a new slide on h1/h2
        if (currentSlide.length > 0) {
          slides.push(currentSlide);
        }
        currentSlide = [];

        if (isFirstHeading && item.level === 1) {
          currentSlide.push({ type: 'title', text: item.text });
          isFirstHeading = false;
        } else {
          currentSlide.push(item);
        }
      } else {
        currentSlide.push(item);
      }
    }
  }

  if (currentSlide.length > 0) {
    slides.push(currentSlide);
  }

  return slides;
}

/**
 * Converts an AST node into slide content items.
 */
function convertNodeToSlideContent(node: RootContent): SlideContent[] {
  switch (node.type) {
    case 'heading':
      return [{
        type: 'heading',
        text: toString(node),
        level: node.depth,
      }];

    case 'paragraph':
      return [{
        type: 'paragraph',
        children: node.children as PhrasingContent[],
      }];

    case 'list': {
      const items: string[] = [];
      for (const item of node.children) {
        if (item.type === 'listItem') {
          items.push(toString(item));
        }
      }
      return [{
        type: 'list',
        ordered: node.ordered === true,
        items,
      }];
    }

    case 'table': {
      const rows = node.children as MdastTableRow[];
      if (rows.length === 0) {
        return [];
      }
      const headers = rows[0].children.map((cell) => toString(cell));
      const dataRows = rows.slice(1).map((row) =>
        row.children.map((cell) => toString(cell)),
      );
      return [{
        type: 'table',
        headers,
        rows: dataRows,
      }];
    }

    case 'code':
      return [{
        type: 'code',
        value: node.value,
        lang: node.lang ?? undefined,
      }];

    case 'blockquote': {
      const text = toString(node);
      if (text) {
        return [{
          type: 'paragraph',
          children: [{ type: 'text', value: `\u201C${text}\u201D` } as PhrasingContent],
        }];
      }
      return [];
    }

    default: {
      const text = toString(node);
      if (text) {
        return [{
          type: 'paragraph',
          children: [{ type: 'text', value: text } as PhrasingContent],
        }];
      }
      return [];
    }
  }
}

/**
 * Renders a single slide's content items onto a PptxGenJS slide.
 */
function renderSlide(pptx: PptxGenJS, contents: SlideContent[]): void {
  const slide = pptx.addSlide();
  let y = 0.4;
  const xMargin = 0.6;
  const contentWidth = 12.13;
  const maxY = 6.8;

  for (const item of contents) {
    if (y >= maxY) {
      break;
    }

    switch (item.type) {
      case 'title': {
        slide.addText(item.text, {
          x: xMargin,
          y: 2.0,
          w: contentWidth,
          fontSize: 36,
          bold: true,
          color: THEME.title,
          fontFace: FONT.heading,
          align: 'center',
        });
        y = 4.5;
        break;
      }

      case 'heading': {
        const fontSize = item.level <= 2 ? 28 : item.level === 3 ? 22 : 18;
        slide.addText(item.text, {
          x: xMargin,
          y,
          w: contentWidth,
          fontSize,
          bold: true,
          color: item.level <= 2 ? THEME.title : THEME.accent,
          fontFace: FONT.heading,
        });
        y += fontSize <= 18 ? 0.5 : 0.7;
        break;
      }

      case 'paragraph': {
        const textParts = inlineNodesToTextProps(item.children);
        if (textParts.length > 0) {
          slide.addText(textParts, {
            x: xMargin,
            y,
            w: contentWidth,
            fontSize: 14,
            color: THEME.body,
            fontFace: FONT.body,
            lineSpacingMultiple: 1.3,
            wrap: true,
          });
          const estimatedLines = Math.ceil(toString({ type: 'paragraph', children: item.children }).length / 120);
          y += Math.max(0.4, estimatedLines * 0.3);
        }
        break;
      }

      case 'list': {
        const bulletItems: PptxGenJS.TextProps[] = item.items.map((text, idx) => ({
          text: item.ordered ? `${idx + 1}. ${text}` : text,
          options: {
            fontSize: 14,
            color: THEME.body,
            fontFace: FONT.body,
            bullet: item.ordered ? false : { code: '2022' },
            indentLevel: 0,
            lineSpacingMultiple: 1.4,
          },
        }));

        slide.addText(bulletItems, {
          x: xMargin + 0.2,
          y,
          w: contentWidth - 0.2,
          wrap: true,
        });
        y += item.items.length * 0.35 + 0.15;
        break;
      }

      case 'table': {
        const tableRows: PptxGenJS.TableRow[] = [];

        // Header row
        tableRows.push(
          item.headers.map((header) => ({
            text: header,
            options: {
              bold: true,
              fontSize: 11,
              color: THEME.tableHeaderText,
              fill: { color: THEME.tableHeader },
              fontFace: FONT.body,
              border: [
                { type: 'solid' as const, pt: 0.5, color: THEME.tableBorder },
                { type: 'solid' as const, pt: 0.5, color: THEME.tableBorder },
                { type: 'solid' as const, pt: 0.5, color: THEME.tableBorder },
                { type: 'solid' as const, pt: 0.5, color: THEME.tableBorder },
              ],
              valign: 'middle' as const,
            },
          })),
        );

        // Data rows
        for (const row of item.rows) {
          tableRows.push(
            row.map((cell) => ({
              text: cell,
              options: {
                fontSize: 10,
                color: THEME.body,
                fontFace: FONT.body,
                border: [
                  { type: 'solid' as const, pt: 0.5, color: THEME.tableBorder },
                  { type: 'solid' as const, pt: 0.5, color: THEME.tableBorder },
                  { type: 'solid' as const, pt: 0.5, color: THEME.tableBorder },
                  { type: 'solid' as const, pt: 0.5, color: THEME.tableBorder },
                ],
                valign: 'middle' as const,
              },
            })),
          );
        }

        const colW = item.headers.map(() => contentWidth / item.headers.length);

        slide.addTable(tableRows, {
          x: xMargin,
          y,
          w: contentWidth,
          colW,
          rowH: 0.35,
          autoPage: false,
        });

        y += (item.rows.length + 1) * 0.35 + 0.2;
        break;
      }

      case 'code': {
        const codeText = item.value.length > 800
          ? item.value.slice(0, 800) + '\n...'
          : item.value;

        slide.addText(codeText, {
          x: xMargin,
          y,
          w: contentWidth,
          fontSize: 10,
          fontFace: FONT.code,
          color: THEME.codeText,
          fill: { color: THEME.codeBackground },
          lineSpacingMultiple: 1.2,
          wrap: true,
        });

        const codeLines = codeText.split('\n').length;
        y += Math.max(0.5, codeLines * 0.2) + 0.15;
        break;
      }
    }
  }
}

/**
 * Converts inline mdast nodes to PptxGenJS TextProps for rich text formatting.
 */
function inlineNodesToTextProps(nodes: PhrasingContent[]): PptxGenJS.TextProps[] {
  const parts: PptxGenJS.TextProps[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        parts.push({
          text: node.value,
          options: { fontSize: 14, fontFace: FONT.body, color: THEME.body },
        });
        break;

      case 'strong':
        parts.push({
          text: toString(node),
          options: { fontSize: 14, fontFace: FONT.body, color: THEME.body, bold: true },
        });
        break;

      case 'emphasis':
        parts.push({
          text: toString(node),
          options: { fontSize: 14, fontFace: FONT.body, color: THEME.body, italic: true },
        });
        break;

      case 'inlineCode':
        parts.push({
          text: node.value,
          options: { fontSize: 12, fontFace: FONT.code, color: THEME.codeText },
        });
        break;

      case 'link':
        parts.push({
          text: toString(node),
          options: {
            fontSize: 14,
            fontFace: FONT.body,
            color: THEME.accent,
            underline: { style: 'sng' },
            hyperlink: { url: node.url },
          },
        });
        break;

      case 'break':
        parts.push({ text: '\n', options: {} });
        break;

      default: {
        const text = toString(node);
        if (text) {
          parts.push({
            text,
            options: { fontSize: 14, fontFace: FONT.body, color: THEME.body },
          });
        }
        break;
      }
    }
  }

  return parts;
}
