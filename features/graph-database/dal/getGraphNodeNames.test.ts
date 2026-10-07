import { getGraphDatabaseSource } from '@/features/graph-database';
import getGraphNodeNames from '@/features/graph-database/dal/getGraphNodeNames';
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
const accessibleDocumentIds = new Set(['doc-1']) as unknown as AccessibleDocIds;

describe('getGraphNodeNames', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run });
  });

  it('returns early for an empty id list without touching the graph', async () => {
    await expect(getGraphNodeNames({ ids: [], accessibleDocumentIds })).resolves.toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it('echoes each requested id with its resolved name, and flags unknown ids', async () => {
    run.mockResolvedValue({
      records: [
        record({ id: 'entity-1', name: 'Shield AI', kind: 'entity' }),
        record({ id: 'concept-1', name: 'Zero Trust', kind: 'concept' }),
        record({ id: 'foreign-or-bogus', name: null, kind: null }),
      ],
    });

    const result = await getGraphNodeNames({
      ids: ['entity-1', 'concept-1', 'foreign-or-bogus'],
      accessibleDocumentIds,
    });

    expect(run).toHaveBeenCalledWith(expect.any(String), {
      ids: ['entity-1', 'concept-1', 'foreign-or-bogus'],
      documentIds: ['doc-1'],
    });
    // Pins the access wall: an id outside the caller's documents must resolve
    // to found: false, never to another user's node name.
    expect(run.mock.calls[0][0]).toContain('WHERE n.documentId IN $documentIds');
    expect(result).toEqual([
      { id: 'entity-1', name: 'Shield AI', kind: 'entity', found: true },
      { id: 'concept-1', name: 'Zero Trust', kind: 'concept', found: true },
      { id: 'foreign-or-bogus', name: null, kind: null, found: false },
    ]);
  });

  it('logs internal failures and throws a sanitized error', async () => {
    const error = new Error('Neo4j password');
    run.mockRejectedValue(error);

    await expect(getGraphNodeNames({
      ids: ['entity-1'],
      accessibleDocumentIds,
    })).rejects.toThrow('Error resolving graph node names');

    expect(logger.error).toHaveBeenCalledWith(
      'Error resolving graph node names',
      { idCount: 1, error },
    );
  });
});
