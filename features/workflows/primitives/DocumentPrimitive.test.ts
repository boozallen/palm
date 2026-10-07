/**
 * Unit tests for DocumentPrimitive
 *
 * Core behavior under test:
 * - Validation: requires a documentId to be configured
 * - Execution: fetches document from DB and returns document reference with name
 * - Error handling: handles missing documents gracefully
 */

import { DocumentPrimitive } from '@/features/workflows/primitives/DocumentPrimitive';
import { PrimitiveContext } from '@/features/workflows/types/primitive';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  document: {
    findUnique: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const mockFindUnique = db.document.findUnique as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// Helpers

const makeContext = (): PrimitiveContext => ({
  input: {} as Record<string, never>,
  state: {} as Record<string, never>,
  workflowId: 'wf-1',
  executionId: 'ex-1',
  userId: 'user-1',
});

const makePrimitive = (documentId?: string) =>
  new DocumentPrimitive({
    id: 'step-doc',
    name: 'Document Input',
    config: documentId ? { documentId } : {},
  });

// Tests

describe('DocumentPrimitive validation', () => {
  it('fails validation when no documentId is configured', async () => {
    const primitive = makePrimitive();
    const result = await primitive.validate();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Document Input requires a document. Configure this step to select a document.');
  });

  it('passes validation when documentId is configured', async () => {
    const primitive = makePrimitive('doc-123');
    const result = await primitive.validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });
});

describe('DocumentPrimitive execution', () => {
  it('returns error when no documentId is configured', async () => {
    const primitive = makePrimitive();
    const context = makeContext();

    const result = await primitive.execute(context);

    expect(result.status).toBe('error');
    expect(result.error).toBe('No document configured for this input.');
  });

  it('returns error when document is not found in database', async () => {
    mockFindUnique.mockResolvedValue(null);

    const primitive = makePrimitive('doc-missing');
    const context = makeContext();

    const result = await primitive.execute(context);

    expect(result.status).toBe('error');
    expect(result.error).toBe('Document doc-missing not found.');
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'doc-missing' },
      select: { id: true, filename: true },
    });
  });

  it('returns success with document details when found', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'doc-123',
      filename: 'quarterly-report.pdf',
    });

    const primitive = makePrimitive('doc-123');
    const context = makeContext();

    const result = await primitive.execute(context);

    expect(result.status).toBe('success');
    expect(result.output).toEqual({
      documents: [{ id: 'doc-123', name: 'quarterly-report.pdf' }],
    });
    expect(result.metadata).toEqual({
      documentId: 'doc-123',
      documentName: 'quarterly-report.pdf',
    });
    expect(logger.info).toHaveBeenCalledWith('Loaded document reference', {
      documentId: 'doc-123',
      filename: 'quarterly-report.pdf',
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'doc-123' },
      select: { id: true, filename: true },
    });
  });

  it('fetches document details for each execution', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'doc-456',
      filename: 'financial-summary.xlsx',
    });

    const primitive = makePrimitive('doc-456');
    const context = makeContext();

    await primitive.execute(context);

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'doc-456' },
      select: { id: true, filename: true },
    });
  });
});
