import { ArtifactPrimitive } from '@/features/workflows/primitives/ArtifactPrimitive';
import { PrimitiveContext } from '@/features/workflows/types/primitive';

jest.mock('exceljs');
jest.mock('docx');

jest.mock('@/features/workflows/dal/createWorkflowArtifact', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import createWorkflowArtifact from '@/features/workflows/dal/createWorkflowArtifact';

const makeContext = (
  input: Record<string, unknown>,
  state: Record<string, unknown> = {},
): PrimitiveContext => ({
  input: input as Record<string, never>,
  state: state as Record<string, never>,
  workflowId: 'wf-1',
  executionId: 'ex-1',
  userId: 'user-1',
});

const makePrimitive = (config: Record<string, unknown> = {}) =>
  new ArtifactPrimitive({
    id: 'artifact-1',
    name: 'Report',
    config: { format: '.md', ...config },
  });

const getArtifactContent = (): string => {
  const createCall = (createWorkflowArtifact as jest.Mock).mock.calls[0][0];
  return createCall.content;
};

describe('ArtifactPrimitive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock database create to return artifact with id
    (createWorkflowArtifact as jest.Mock).mockImplementation(async (params) => ({
      ...params,
      id: 'artifact-id-123',
      createdAt: new Date(),
    }));
  });

  describe('validate', () => {
    it('passes validation with a valid format', async () => {
      const primitive = makePrimitive({ format: '.json' });
      const result = await primitive.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('fails validation with an invalid format', async () => {
      const primitive = makePrimitive({ format: '.pdf' });
      const result = await primitive.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Invalid format: .pdf')]),
      );
    });

    it('fails validation when id is missing', async () => {
      const primitive = new ArtifactPrimitive({
        id: '',
        name: 'Report',
        config: { format: '.md' },
      });
      const result = await primitive.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Primitive ID is required')]),
      );
    });
  });

  describe('execute', () => {
    it('skips execution when condition is not met', async () => {
      const primitive = new ArtifactPrimitive({
        id: 'artifact-1',
        name: 'Report',
        config: { format: '.md' },
        condition: { field: 'status', operator: 'equals', value: 'ready' },
      });
      const context = makeContext({ status: 'not-ready' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.skipped).toBe(true);
    });

    it('defaults to .md format when none specified', async () => {
      const primitive = new ArtifactPrimitive({
        id: 'artifact-1',
        name: 'Report',
        config: {},
      });
      const context = makeContext({ response: 'Hello world' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.artifactId).toBeDefined();
      expect(result.output.fileExtension).toBe('.md');
      expect(result.output.label).toBe('Report');
    });

    it('returns error for unsupported format', async () => {
      const primitive = makePrimitive({ format: '.xyz' });
      const context = makeContext({ data: 'test' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('error');
      expect(result.error).toContain('Unsupported format: .xyz');
    });

    it('uses default filename when none specified', async () => {
      const primitive = makePrimitive();
      const context = makeContext({ response: 'content' });
      const result = await primitive.execute(context);
      expect(result.output.label).toBe('Report');
    });

    it('uses custom filename when specified', async () => {
      const primitive = makePrimitive({ filename: 'My Report' });
      const context = makeContext({ response: 'content' });
      const result = await primitive.execute(context);
      expect(result.output.label).toBe('My Report');
    });

    it('includes metadata with size and generatedAt', async () => {
      const primitive = makePrimitive();
      const context = makeContext({ response: 'content' });
      const result = await primitive.execute(context);
      expect(result.metadata?.size).toBeGreaterThan(0);
      expect(result.metadata?.generatedAt).toBeDefined();
    });

    it('saves artifact to database', async () => {
      const primitive = makePrimitive();
      const context = makeContext({ response: 'test content' });
      await primitive.execute(context);

      expect(createWorkflowArtifact).toHaveBeenCalledWith(
        expect.objectContaining({
          fileExtension: '.md',
          label: 'Report',
          content: expect.any(String),
          workflowExecutionId: 'ex-1',
          primitiveId: 'artifact-1',
        }),
      );
    });
  });

  describe('format generation', () => {
    it('generates JSON output', async () => {
      const primitive = makePrimitive({ format: '.json' });
      const context = makeContext({ key: 'value', num: 42 });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.fileExtension).toBe('.json');
      expect(result.output.artifactId).toBeDefined();

      const parsed = JSON.parse(getArtifactContent());
      expect(parsed.key).toBe('value');
      expect(parsed.num).toBe(42);
    });

    it('generates markdown output for object data', async () => {
      const primitive = makePrimitive({ format: '.md' });
      const context = makeContext({ title: 'Test', summary: 'A summary' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.fileExtension).toBe('.md');

      const content = getArtifactContent();
      expect(content).toContain('**title:**');
      expect(content).toContain('**summary:**');
    });

    it('generates HTML output', async () => {
      const primitive = makePrimitive({ format: '.html' });
      const context = makeContext({ title: 'Test', value: '123' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.fileExtension).toBe('.html');

      const content = getArtifactContent();
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('</html>');
    });

    it('generates CSV output for object data', async () => {
      const primitive = makePrimitive({ format: '.csv' });
      const context = makeContext({ name: 'Alice', age: 30 });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.fileExtension).toBe('.csv');

      const content = getArtifactContent();
      expect(content).toContain('name');
      expect(content).toContain('age');
    });

    it('generates CSV with escaped quotes for string data', async () => {
      const primitive = makePrimitive({ format: '.csv' });
      const context = makeContext({ response: 'She said "hello"' });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('"content"');
      expect(content).toContain('""hello""');
    });

    it('generates plain text output', async () => {
      const primitive = makePrimitive({ format: '.txt' });
      const context = makeContext({ name: 'Test', value: '123' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.fileExtension).toBe('.txt');

      const content = getArtifactContent();
      expect(content).toContain('name: Test');
      expect(content).toContain('value: 123');
    });

    it('generates mermaid output with plain text content type', async () => {
      const primitive = makePrimitive({ format: '.mmd' });
      const context = makeContext({ response: 'graph TD\n  A --> B' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.fileExtension).toBe('.mmd');

      const content = getArtifactContent();
      expect(content).toContain('graph TD');
    });

    it('uses markdown as intermediate for .xlsx format', async () => {
      const primitive = makePrimitive({ format: '.xlsx' });
      const context = makeContext({ response: 'spreadsheet data' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.fileExtension).toBe('.xlsx');
      // Content should be markdown internally, but extension is preserved
      expect(getArtifactContent()).toContain('spreadsheet data');
    });

    it('uses markdown as intermediate for .docx format', async () => {
      const primitive = makePrimitive({ format: '.docx' });
      const context = makeContext({ response: 'doc data' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.fileExtension).toBe('.docx');
      expect(getArtifactContent()).toContain('doc data');
    });

    it('uses markdown as intermediate for .pptx format', async () => {
      const primitive = makePrimitive({ format: '.pptx' });
      const context = makeContext({ response: 'slides data' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.fileExtension).toBe('.pptx');
      expect(getArtifactContent()).toContain('slides data');
    });

    it('uses markdown as intermediate for .mp4 format', async () => {
      const primitive = makePrimitive({ format: '.mp4' });
      const context = makeContext({ response: '[{"id":"1","heading":"Title","layout":"title"}]' });
      const result = await primitive.execute(context);
      expect(result.status).toBe('success');
      expect(result.output.fileExtension).toBe('.mp4');
    });
  });

  describe('data normalization', () => {
    it('extracts value from single-field objects', async () => {
      const primitive = makePrimitive({ format: '.json' });
      const context = makeContext({ response: 'just a string' });
      await primitive.execute(context);

      const parsed = JSON.parse(getArtifactContent());
      expect(parsed).toBe('just a string');
    });

    it('preserves multi-field objects as-is', async () => {
      const primitive = makePrimitive({ format: '.json' });
      const context = makeContext({ a: 1, b: 2 });
      await primitive.execute(context);

      const parsed = JSON.parse(getArtifactContent());
      expect(parsed).toEqual({ a: 1, b: 2 });
    });

    it('returns string directly in markdown when normalized', async () => {
      const primitive = makePrimitive({ format: '.md' });
      const context = makeContext({ response: 'Hello world' });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('Hello world');
    });
  });

  describe('data filtering', () => {
    it('strips internal fields (citations, graphAnchors)', async () => {
      const primitive = makePrimitive({ format: '.json' });
      const context = makeContext({
        response: 'result',
        citations: [{ text: 'cite' }],
        graphAnchors: [{ id: 'anchor' }],
      });
      await primitive.execute(context);

      const parsed = JSON.parse(getArtifactContent());
      expect(parsed).toBe('result');
    });

    it('filters to only includeFields', async () => {
      const primitive = makePrimitive({
        format: '.json',
        includeFields: ['name'],
      });
      const context = makeContext({ name: 'Alice', age: 30, email: 'alice@test.com' });
      await primitive.execute(context);

      const parsed = JSON.parse(getArtifactContent());
      expect(parsed).toBe('Alice');
    });

    it('excludes specified fields', async () => {
      const primitive = makePrimitive({
        format: '.json',
        excludeFields: ['secret'],
      });
      const context = makeContext({ name: 'Alice', secret: 'hidden' });
      await primitive.execute(context);

      const parsed = JSON.parse(getArtifactContent());
      expect(parsed).toBe('Alice');
    });

    it('supports dot notation in includeFields', async () => {
      const primitive = makePrimitive({
        format: '.json',
        includeFields: ['user.name', 'other'],
      });
      const context = makeContext({
        user: { name: 'Alice', age: 30 },
        other: 'data',
      });
      await primitive.execute(context);

      const parsed = JSON.parse(getArtifactContent());
      expect(parsed.user.name).toBe('Alice');
      expect(parsed.other).toBe('data');
    });
  });

  describe('template interpolation', () => {
    it('uses template when provided for markdown', async () => {
      const primitive = makePrimitive({
        format: '.md',
        template: '# Report for {{name}}\n\nScore: {{score}}',
      });
      const context = makeContext({ name: 'Alice', score: 95 });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('# Report for Alice');
      expect(content).toContain('Score: 95');
    });

    it('uses template when provided for HTML', async () => {
      const primitive = makePrimitive({
        format: '.html',
        template: '<h1>{{title}}</h1>',
      });
      const context = makeContext({ title: 'My Report', extra: 'data' });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('<h1>My Report</h1>');
    });

    it('uses template when provided for plain text', async () => {
      const primitive = makePrimitive({
        format: '.txt',
        template: 'Name: {{name}}, Age: {{age}}',
      });
      const context = makeContext({ name: 'Bob', age: 25 });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toBe('Name: Bob, Age: 25');
    });

    it('leaves unresolved placeholders in template', async () => {
      const primitive = makePrimitive({
        format: '.md',
        template: 'Hello {{name}}, your ID is {{id}}',
      });
      const context = makeContext({ name: 'Alice' });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('Alice');
    });

    it('does not use template when data is a string (single-field normalized)', async () => {
      const primitive = makePrimitive({
        format: '.md',
        template: '# {{response}}',
      });
      const context = makeContext({ response: 'Hello' });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toBe('Hello\n\n');
    });
  });

  describe('markdown generation', () => {
    it('renders nested objects with heading and nested key-value pairs', async () => {
      const primitive = makePrimitive({ format: '.md' });
      const context = makeContext({
        overview: { title: 'Test', detail: 'Some detail' },
        summary: 'A summary',
      });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('## overview');
      expect(content).toContain('**title:** Test');
      expect(content).toContain('**detail:** Some detail');
      expect(content).toContain('**summary:** A summary');
    });

    it('renders arrays as numbered lists', async () => {
      const primitive = makePrimitive({ format: '.md' });
      const context = makeContext({
        items: ['apple', 'banana', 'cherry'],
        other: 'data',
      });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('1. apple');
      expect(content).toContain('2. banana');
      expect(content).toContain('3. cherry');
    });
  });

  describe('HTML generation', () => {
    it('renders string data as paragraph with line breaks', async () => {
      const primitive = makePrimitive({ format: '.html' });
      const context = makeContext({ response: 'Line 1\nLine 2' });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('<p>Line 1<br>Line 2</p>');
    });

    it('renders object data as a table', async () => {
      const primitive = makePrimitive({ format: '.html' });
      const context = makeContext({ name: 'Alice', role: 'Admin' });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('<table>');
      expect(content).toContain('<th>Field</th>');
      expect(content).toContain('<td>name</td>');
      expect(content).toContain('<td>Alice</td>');
    });

    it('passes through a complete HTML document from LLM without wrapping', async () => {
      const fullHtml = '<!DOCTYPE html>\n<html><head><title>Dashboard</title></head><body><h1>Hello</h1></body></html>';
      const primitive = makePrimitive({ format: '.html' });
      const context = makeContext({ response: fullHtml });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toBe(fullHtml);
      expect(content).not.toContain('<p>');
    });

    it('passes through HTML starting with <html> tag (no doctype)', async () => {
      const fullHtml = '<html><head></head><body><div>Content</div></body></html>';
      const primitive = makePrimitive({ format: '.html' });
      const context = makeContext({ response: fullHtml });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toBe(fullHtml);
    });

    it('strips markdown code fence markers from complete HTML documents', async () => {
      const fullHtml = '<!DOCTYPE html>\n<html><head><title>Test</title></head><body><h1>Content</h1></body></html>';
      const wrappedHtml = '```html\n' + fullHtml + '\n```';
      const primitive = makePrimitive({ format: '.html' });
      const context = makeContext({ response: wrappedHtml });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toBe(fullHtml);
      expect(content).not.toContain('```');
    });

    it('still wraps plain text strings in the default HTML template', async () => {
      const primitive = makePrimitive({ format: '.html' });
      const context = makeContext({ response: 'Just some plain text' });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<p>Just some plain text</p>');
    });
  });

  describe('plain text generation', () => {
    it('renders nested objects with indentation', async () => {
      const primitive = makePrimitive({ format: '.txt' });
      const context = makeContext({
        user: { name: 'Alice', role: 'Admin' },
        status: 'active',
      });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('user:');
      expect(content).toContain('  name: Alice');
      expect(content).toContain('status: active');
    });

    it('renders arrays as numbered lists in plain text', async () => {
      const primitive = makePrimitive({ format: '.txt' });
      const context = makeContext({
        items: ['a', 'b'],
        count: 2,
      });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toContain('1. a');
      expect(content).toContain('2. b');
    });

    it('returns string directly when normalized', async () => {
      const primitive = makePrimitive({ format: '.txt' });
      const context = makeContext({ response: 'Just text' });
      await primitive.execute(context);

      const content = getArtifactContent();
      expect(content).toBe('Just text');
    });
  });
});
