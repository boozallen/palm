import { getGraphDatabaseSource } from '@/features/graph-database';
import resolveGraphNodesByName from '@/features/graph-database/dal/resolveGraphNodesByName';
import logger from '@/server/logger';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

jest.mock('@/features/graph-database', () => ({
  getGraphDatabaseSource: jest.fn(),
}));
jest.mock('@/server/logger');

const run = jest.fn();
const record = (values: Record<string, unknown>) => ({
  get: (key: string) => values[key],
});
const accessibleDocumentIds = new Set(['doc-1', 'doc-2']) as unknown as AccessibleDocIds;

describe('resolveGraphNodesByName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run });
  });

  it('returns early for an empty name list without touching the graph', async () => {
    await expect(resolveGraphNodesByName({
      names: [],
      kind: 'entity',
      accessibleDocumentIds,
    })).resolves.toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it('resolves each name to every matching node id, scoped to accessible documents', async () => {
    run.mockResolvedValue({
      records: [
        record({ name: 'Shield AI', ids: ['entity-1', 'entity-2'] }),
        record({ name: 'Nonexistent Co', ids: [] }),
      ],
    });

    const result = await resolveGraphNodesByName({
      names: ['Shield AI', 'Nonexistent Co'],
      kind: 'entity',
      accessibleDocumentIds,
    });

    expect(run).toHaveBeenCalledWith(expect.any(String), {
      names: ['Shield AI', 'Nonexistent Co'],
      documentIds: ['doc-1', 'doc-2'],
    });
    // Pins the access wall: name resolution must never match nodes outside
    // the caller's accessible documents.
    expect(run.mock.calls[0][0]).toContain('n.documentId IN $documentIds');
    expect(result).toEqual([
      { name: 'Shield AI', ids: ['entity-1', 'entity-2'] },
      { name: 'Nonexistent Co', ids: [] },
    ]);
  });

  it('queries the label matching the requested kind, with aliases only for entities', async () => {
    run.mockResolvedValue({ records: [] });

    await resolveGraphNodesByName({
      names: ['Zero Trust'],
      kind: 'concept',
      accessibleDocumentIds,
    });
    await resolveGraphNodesByName({
      names: ['Shield AI'],
      kind: 'entity',
      accessibleDocumentIds,
    });

    const [conceptQuery] = run.mock.calls[0];
    expect(conceptQuery).toContain('(n:Concept)');
    expect(conceptQuery).not.toContain('(n:Entity)');
    // Concept nodes never carry aliases at ingestion, so their query must not
    // imply alias support.
    expect(conceptQuery).not.toContain('aliases');

    const [entityQuery] = run.mock.calls[1];
    expect(entityQuery).toContain('(n:Entity)');
    expect(entityQuery).toContain('aliases');
  });

  it('logs internal failures and throws a sanitized error', async () => {
    const error = new Error('Neo4j password');
    run.mockRejectedValue(error);

    await expect(resolveGraphNodesByName({
      names: ['Shield AI'],
      kind: 'entity',
      accessibleDocumentIds,
    })).rejects.toThrow('Error resolving graph nodes by name');

    expect(logger.error).toHaveBeenCalledWith(
      'Error resolving graph nodes by name',
      { kind: 'entity', nameCount: 1, error },
    );
  });
});
