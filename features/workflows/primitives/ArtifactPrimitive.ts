/**
 * Report Generator Primitive
 * Formats workflow data into various output formats
 */

import ExcelJS from 'exceljs';
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import { BasePrimitive } from '@/features/workflows/primitives/BasePrimitive';
import {
  PrimitiveContext,
  PrimitiveResult,
  PrimitiveType,
  ArtifactConfig,
} from '@/features/workflows/types/primitive';
import { WORKFLOW_ARTIFACT_FILE_TYPES } from '@/features/shared/types/document';
import { isCompleteHTMLDocument, stripMarkdownCodeFence } from '@/features/workflows/utils/primitive-helpers';
import createWorkflowArtifact from '@/features/workflows/dal/createWorkflowArtifact';

export class ArtifactPrimitive extends BasePrimitive {
  private readonly artifactConfig: ArtifactConfig;

  constructor(config: any) {
    super({
      ...config,
      type: PrimitiveType.ARTIFACT,
    });
    this.artifactConfig = config.config as ArtifactConfig;
  }

  async validate(): Promise<{ valid: boolean; errors?: string[] }> {
    const baseValidation = await super.validate();
    const errors = baseValidation.errors || [];

    if (this.artifactConfig.format && !WORKFLOW_ARTIFACT_FILE_TYPES.includes(this.artifactConfig.format as any)) {
      errors.push(
        `Invalid format: ${this.artifactConfig.format}. Must be one of: ${WORKFLOW_ARTIFACT_FILE_TYPES.join(', ')}`
      );
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async execute(context: PrimitiveContext): Promise<PrimitiveResult> {
    if (!this.shouldExecute(context)) {
      return this.success({ skipped: true }, { reason: 'Condition not met' });
    }

    try {
      const format = this.artifactConfig?.format || '.md';

      // Filter data based on include/exclude fields
      let data: Record<string, any> | string = this.filterData(context.input);

      // Normalize data - extract content value from single-field objects (e.g., {response: "..."})
      data = this.normalizeData(data);

      // Generate artifact in specified file type
      let content: string;
      switch (format) {
        case '.json':
          content = this.generateJSON(data);
          break;
        case '.html':
          content = this.generateHTML(data);
          break;
        case '.csv':
          content = this.generateCSV(data);
          break;
        case '.txt':
        case '.mmd':
          content = this.generatePlainText(data);
          break;
        case '.md':
        case '.xlsx':
        case '.docx':
        case '.pptx':
        case '.mp4':
          content = this.generateMarkdown(data);
          break;
        default:
          return this.error(`Unsupported format: ${format}`);
      }

      const filename = this.artifactConfig?.filename || this.config.name;

      // Save artifact to database
      const artifact = await createWorkflowArtifact({
        fileExtension: format,
        label: filename,
        content,
        workflowExecutionId: context.executionId,
        primitiveId: this.config.id,
      });

      // Return only artifact reference - content fetched on-demand
      return this.success(
        {
          artifactId: artifact.id,
          label: artifact.label,
          fileExtension: artifact.fileExtension,
        },
        {
          size: content.length,
          generatedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      return this.error(
        `Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Filter data based on include/exclude fields
   */
  private filterData(data: Record<string, any>): Record<string, any> {
    // Strip RAG metadata fields — these are for UI display only, not report content
    const INTERNAL_FIELDS = ['citations', 'graphAnchors'];
    const cleaned = { ...data };
    for (const field of INTERNAL_FIELDS) {
      delete cleaned[field];
    }

    if (this.artifactConfig.includeFields) {
      const filtered: Record<string, any> = {};
      for (const field of this.artifactConfig.includeFields) {
        const value = this.getFieldValue(cleaned, field);
        if (value !== undefined) {
          this.setFieldValue(filtered, field, value);
        }
      }
      return filtered;
    }

    if (this.artifactConfig.excludeFields) {
      for (const field of this.artifactConfig.excludeFields) {
        delete cleaned[field];
      }
      return cleaned;
    }

    return cleaned;
  }

  /**
   * Normalize data - extract content value from single-field objects
   * For example: {response: "text"} becomes "text"
   * This centralizes the logic instead of repeating it in each formatter
   */
  private normalizeData(data: Record<string, any>): Record<string, any> | string {
    const entries = Object.entries(data);

    // If only one field, extract and return its value
    if (entries.length === 1) {
      const [, value] = entries[0];
      // Return the value directly (could be string, object, array, etc.)
      return value;
    }

    // Otherwise return data as-is
    return data;
  }

  /**
   * Generate JSON
   */
  private generateJSON(data: Record<string, any> | string): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate Markdown
   */
  private generateMarkdown(data: Record<string, any> | string): string {
    let md = '';

    if (this.artifactConfig.template && typeof data !== 'string') {
      // Use template if provided (only works with objects)
      md += this.interpolateTemplate(this.artifactConfig.template, data);
    } else {
      // Generate default markdown
      md += this.dataToMarkdown(data);
    }

    return md;
  }

  /**
   * Generate HTML
   */
  private generateHTML(data: Record<string, any> | string): string {
    // Strip markdown code fence markers if present
    if (typeof data === 'string') {
      data = stripMarkdownCodeFence(data);
    }

    // If the LLM already produced a complete HTML document, return it as-is
    if (typeof data === 'string' && isCompleteHTMLDocument(data)) {
      return data;
    }

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Web Page</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
`;

    if (this.artifactConfig.template && typeof data !== 'string') {
      // Use template if provided (only works with objects)
      html += this.interpolateTemplate(this.artifactConfig.template, data);
    } else {
      html += this.dataToHTML(data);
    }

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Generate CSV
   */
  private generateCSV(data: Record<string, any> | string): string {
    // If data is already a string (normalized upstream), create simple CSV
    if (typeof data === 'string') {
      return `"content"\n"${data.replace(/"/g, '""')}"`;
    }

    // Convert object to flat key-value pairs
    const flatData = this.flattenObject(data);
    const headers = Object.keys(flatData);
    const values = Object.values(flatData).map((v) =>
      typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)
    );

    return `${headers.join(',')}\n${values.join(',')}`;
  }

  /**
   * Generate Plain Text
   */
  private generatePlainText(data: Record<string, any> | string): string {
    let text = '';

    if (this.artifactConfig.template && typeof data !== 'string') {
      // Use template if provided (only works with objects)
      text += this.interpolateTemplate(this.artifactConfig.template, data);
    } else {
      // Generate default plain text
      text += this.dataToPlainText(data);
    }

    return text;
  }

  /**
   * Convert data to markdown format
   */
  private dataToMarkdown(
    data: Record<string, any> | string,
    level: number = 2
  ): string {
    // If data is already a string (normalized upstream), return it directly
    if (typeof data === 'string') {
      return data + '\n\n';
    }

    let md = '';
    const heading = '#'.repeat(level);

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        md += `${heading} ${key}\n\n`;
        md += this.dataToMarkdown(value, level + 1);
      } else if (Array.isArray(value)) {
        md += `${heading} ${key}\n\n`;
        value.forEach((item, index) => {
          md += `${index + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}\n`;
        });
        md += '\n';
      } else {
        md += `**${key}:** ${value}\n\n`;
      }
    }

    return md;
  }

  /**
   * Convert data to HTML format
   */
  private dataToHTML(data: Record<string, any> | string): string {
    // If data is already a string (normalized upstream), wrap in paragraph
    if (typeof data === 'string') {
      return `<p>${data.replace(/\n/g, '<br>')}</p>`;
    }

    let html = '<table>';
    html += '<tr><th>Field</th><th>Value</th></tr>';

    const flatData = this.flattenObject(data);
    for (const [key, value] of Object.entries(flatData)) {
      html += `<tr><td>${key}</td><td>${value}</td></tr>`;
    }

    html += '</table>';
    return html;
  }

  /**
   * Convert data to plain text format
   */
  private dataToPlainText(
    data: Record<string, any> | string,
    level: number = 0
  ): string {
    // If data is already a string (normalized upstream), return it directly
    if (typeof data === 'string') {
      return data;
    }

    let text = '';
    const indent = '  '.repeat(level);

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        text += `${indent}${key}:\n`;
        text += this.dataToPlainText(value, level + 1);
      } else if (Array.isArray(value)) {
        text += `${indent}${key}:\n`;
        value.forEach((item, index) => {
          text += `${indent}  ${index + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}\n`;
        });
        text += '\n';
      } else {
        text += `${indent}${key}: ${value}\n`;
      }
    }

    return text;
  }

  /**
   * Flatten nested object into dot-notation keys
   */
  private flattenObject(
    obj: Record<string, any>,
    prefix: string = ''
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  /**
   * Generate XLSX using ExcelJS.
   * Handles batchResults arrays specially - one row per result.
   * Falls back to a flat key/value sheet for generic data.
   */
  private async generateXLSX(data: Record<string, any> | string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Palm Workflow';
    workbook.created = new Date();

    // If data is already a string (normalized upstream), create simple sheet
    if (typeof data === 'string') {
      const sheet = workbook.addWorksheet('Report');
      sheet.columns = [{ header: 'Content', key: 'content', width: 100 }];
      const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } },
      };
      sheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });
      sheet.addRow({ content: data });
      sheet.getColumn('content').alignment = { wrapText: true, vertical: 'top' };
      return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
    }

    // Special handling for Prompt Batch output
    if (Array.isArray(data.batchResults)) {
      const sheet = workbook.addWorksheet('Results');

      // Bold header style
      const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } },
      };

      sheet.columns = [
        { header: 'Prompt Name', key: 'promptName', width: 30 },
        { header: 'Response', key: 'response', width: 80 },
        { header: 'Error', key: 'error', width: 40 },
      ];

      sheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      for (const result of data.batchResults) {
        sheet.addRow({
          promptName: result.promptName || result.promptId || '',
          response: result.response || '',
          error: result.error || '',
        });
      }

      // Wrap text in response column
      sheet.getColumn('response').alignment = { wrapText: true, vertical: 'top' };
      sheet.getColumn('promptName').alignment = { vertical: 'top' };
    } else {
      // Generic flat key/value sheet
      const sheet = workbook.addWorksheet('Report');
      const flat = this.flattenObject(data);

      sheet.columns = [
        { header: 'Field', key: 'field', width: 35 },
        { header: 'Value', key: 'value', width: 80 },
      ];

      const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } },
      };
      sheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle;
      });

      for (const [key, value] of Object.entries(flat)) {
        sheet.addRow({ field: key, value: String(value ?? '') });
      }

      sheet.getColumn('value').alignment = { wrapText: true, vertical: 'top' };
    }

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  /**
   * Generate Word (.docx)
   * Parses basic markdown from LLM response (headings, bullets, bold) into
   * native Word elements. Falls back to key/value pairs for generic data.
   */
  private async generateDOCX(data: Record<string, any> | string): Promise<Buffer> {
    const children: Paragraph[] = [];

    // If data is already a string (normalized upstream), use it directly
    const content: string = typeof data === 'string' ? data : (data.response ?? '');

    if (content) {
      for (const line of content.split('\n')) {
        if (line.startsWith('### ')) {
          children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
        } else if (line.startsWith('## ')) {
          children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
        } else if (line.startsWith('# ')) {
          children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
        } else if (line.trim() === '') {
          children.push(new Paragraph({ text: '' }));
        } else {
          // Inline bold (**text**)
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          const runs = parts.map((part) =>
            part.startsWith('**') && part.endsWith('**')
              ? new TextRun({ text: part.slice(2, -2), bold: true })
              : new TextRun({ text: part })
          );
          children.push(new Paragraph({ children: runs }));
        }
      }
    } else if (typeof data === 'object') {
      // Generic key/value fallback for objects
      const flat = this.flattenObject(data);
      for (const [key, value] of Object.entries(flat)) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${key}: `, bold: true }),
              new TextRun({ text: String(value ?? '') }),
            ],
          })
        );
      }
    }

    const doc = new Document({ sections: [{ children }] });
    return Packer.toBuffer(doc) as Promise<Buffer>;
  }

  /**
   * Interpolate template with data
   */
  private interpolateTemplate(
    template: string,
    data: Record<string, any>
  ): string {
    let result = template;

    // Replace {{field.path}} with actual values
    const regex = /\{\{([^}]+)\}\}/g;
    result = result.replace(regex, (match, path) => {
      const value = this.getFieldValue(data, path.trim());
      return value !== undefined ? String(value) : match;
    });

    return result;
  }

}
