import {
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, RootContent, PhrasingContent, TableRow as MdastTableRow } from 'mdast';
import { toString } from 'mdast-util-to-string';

/**
 * Converts markdown content to a Word document blob
 *
 * Uses remark to parse markdown into an AST, then converts the AST to docx elements.
 * Supports: headings, bold, italic, bullet lists, numbered lists, paragraphs, tables, links, and code blocks.
 */
export async function convertMarkdownToDocx(content: string): Promise<Blob> {
  // Parse markdown into an Abstract Syntax Tree (AST)
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm) // Adds support for tables, strikethrough, task lists, etc.
    .parse(content);

  // Convert AST to docx elements
  const elements = await convertAstToDocx(tree);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: '%2.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 1440, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [{
      properties: {},
      children: elements,
    }],
  });

  const buffer = await Packer.toBlob(doc);

  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Converts an mdast Root node to an array of docx elements
 */
async function convertAstToDocx(tree: Root): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = [];

  for (const node of tree.children) {
    const converted = await convertNode(node, 0);
    if (converted) {
      elements.push(...converted);
    }
  }

  return elements;
}

/**
 * Converts a single mdast node to docx elements
 */
async function convertNode(node: RootContent, listLevel: number = 0): Promise<(Paragraph | Table)[]> {
  switch (node.type) {
    case 'heading':
      return [convertHeading(node)];

    case 'paragraph':
      return [convertParagraph(node)];

    case 'list':
      return await convertList(node, listLevel);

    case 'code':
      return [convertCodeBlock(node)];

    case 'blockquote':
      return convertBlockquote(node);

    case 'thematicBreak':
      return [new Paragraph({
        text: '',
        border: {
          bottom: {
            color: '000000',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: { before: 200, after: 200 },
      })];

    case 'table':
      return [convertTable(node)];

    default:
      // For unknown node types, try to extract text
      const text = toString(node);
      if (text) {
        return [new Paragraph({ text })];
      }
      return [];
  }
}

/**
 * Converts a heading node to a Paragraph with heading style
 */
function convertHeading(node: any): Paragraph {
  const textRuns = convertInlineNodes(node.children);

  const headingLevels: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };

  const spacing = {
    1: { before: 240, after: 120 },
    2: { before: 200, after: 100 },
    3: { before: 160, after: 80 },
    4: { before: 120, after: 60 },
    5: { before: 100, after: 50 },
    6: { before: 80, after: 40 },
  };

  return new Paragraph({
    children: textRuns,
    heading: headingLevels[node.depth] || HeadingLevel.HEADING_1,
    spacing: spacing[node.depth as keyof typeof spacing] || spacing[1],
  });
}

/**
 * Converts a paragraph node to a Paragraph
 */
function convertParagraph(node: any): Paragraph {
  const textRuns = convertInlineNodes(node.children);

  return new Paragraph({
    children: textRuns,
    spacing: { before: 100, after: 100 },
  });
}

/**
 * Converts a list node to an array of Paragraphs
 */
async function convertList(node: any, listLevel: number): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  const isOrdered = node.ordered === true;

  for (const item of node.children) {
    if (item.type === 'listItem') {
      // Handle list items that may contain paragraphs or nested lists
      for (const child of item.children) {
        if (child.type === 'paragraph') {
          const textRuns = convertInlineNodes(child.children);
          paragraphs.push(new Paragraph({
            children: textRuns,
            bullet: !isOrdered ? { level: listLevel } : undefined,
            numbering: isOrdered ? { reference: 'default-numbering', level: listLevel } : undefined,
            spacing: { before: 50, after: 50 },
          }));
        } else if (child.type === 'list') {
          // Nested list
          const nestedList = await convertList(child, listLevel + 1);
          paragraphs.push(...nestedList);
        } else {
          // Other content in list item
          const converted = await convertNode(child, listLevel);
          // Filter to only include Paragraphs (tables can't be in lists in Word)
          paragraphs.push(...converted.filter(item => item instanceof Paragraph));
        }
      }
    }
  }

  return paragraphs;
}

/**
 * Converts a code block to a Paragraph with monospace font
 */
function convertCodeBlock(node: any): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: node.value || '',
        font: 'Courier New',
        size: 20,
      }),
    ],
    shading: {
      fill: 'F5F5F5',
    },
    spacing: { before: 100, after: 100 },
  });
}

/**
 * Converts a blockquote to paragraphs with indentation
 */
function convertBlockquote(node: any): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const child of node.children) {
    if (child.type === 'paragraph') {
      const textRuns = child.children.flatMap((inlineNode: PhrasingContent) =>
        convertInlineNode(inlineNode, { italic: true })
      );
      paragraphs.push(new Paragraph({
        children: textRuns,
        indent: { left: 720 },
        spacing: { before: 100, after: 100 },
      }));
    }
  }

  return paragraphs;
}

/**
 * Converts a table node to a Table
 */
function convertTable(node: any): Table {
  const rows: TableRow[] = [];

  for (const rowNode of node.children as MdastTableRow[]) {
    const cells: TableCell[] = [];

    for (const cellNode of rowNode.children) {
      const textRuns = convertInlineNodes(cellNode.children);
      cells.push(new TableCell({
        children: [new Paragraph({ children: textRuns })],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        },
      }));
    }

    rows.push(new TableRow({ children: cells }));
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/**
 * Converts inline nodes (text, emphasis, strong, etc.) to TextRuns
 */
function convertInlineNodes(nodes: PhrasingContent[]): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];

  for (const node of nodes) {
    runs.push(...convertInlineNode(node));
  }

  return runs;
}

/**
 * Converts a single inline node to TextRuns
 */
export function convertInlineNode(node: PhrasingContent, formatting: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean } = {}): (TextRun | ExternalHyperlink)[] {
  switch (node.type) {
    case 'text':
      return [new TextRun({
        text: node.value,
        bold: formatting.bold,
        italics: formatting.italic,
        underline: formatting.underline ? {} : undefined,
        strike: formatting.strike,
      })];

    case 'strong':
      return node.children.flatMap((child: PhrasingContent) =>
        convertInlineNode(child, { ...formatting, bold: true })
      );

    case 'emphasis':
      return node.children.flatMap((child: PhrasingContent) =>
        convertInlineNode(child, { ...formatting, italic: true })
      );

    case 'delete':
      return node.children.flatMap((child: PhrasingContent) =>
        convertInlineNode(child, { ...formatting, strike: true })
      );

    case 'inlineCode':
      return [new TextRun({
        text: node.value,
        font: 'Courier New',
        bold: formatting.bold,
        italics: formatting.italic,
      })];

    case 'link':
      return [new ExternalHyperlink({
        link: node.url,
        children: [new TextRun({
          text: toString(node),
          style: 'Hyperlink',
          bold: formatting.bold,
          italics: formatting.italic,
          strike: formatting.strike,
        })],
      })];

    case 'break':
      return [new TextRun({ text: '', break: 1 })];

    default:
      // For unknown inline types, try to extract text
      const text = toString(node);
      if (text) {
        return [new TextRun({
          text,
          bold: formatting.bold,
          italics: formatting.italic,
        })];
      }
      return [];
  }
}
