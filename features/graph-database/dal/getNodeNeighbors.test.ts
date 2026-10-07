import { getGraphDatabaseSource } from '@/features/graph-database';
import { getNodeNeighbors } from '@/features/graph-database/dal/getNodeNeighbors';

jest.mock('@/features/graph-database');

describe('getNodeNeighbors conversation isolation', () => {
  it('returns no conversation neighbors for a document-scoped read', async () => {
    const documentIds = ['doc-1'];
    const graphNeighbors = [
      {
        id: 2,
        labels: ['Message'],
        properties: { id: 'message-1' },
      },
    ];
    const scopedNeighbors = graphNeighbors.filter(({ properties }) => (
      'documentId' in properties && documentIds.includes(properties.documentId as string)
    ));
    const session = {
      run: jest.fn()
        .mockResolvedValueOnce({
          records: [{
            get: (field: string) => ({
              sourceNeoId: 1,
              sourceLabels: ['Entity'],
              sourceProps: { id: 'entity-1', documentId: 'doc-1' },
            })[field],
          }],
        })
        .mockResolvedValueOnce({
          records: scopedNeighbors.map((neighbor) => ({
            get: () => neighbor.id,
          })),
        }),
      close: jest.fn(),
    };
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({
      getSession: jest.fn().mockResolvedValue(session),
    });

    const result = await getNodeNeighbors({ documentIds, nodeNeoId: 1 });

    const labels = [result.sourceNode, ...result.neighbors].flatMap((node) => node.labels);
    expect(labels).not.toContain('Chat');
    expect(labels).not.toContain('Message');
    expect(labels).not.toContain('Artifact');
    expect(result.neighbors).toHaveLength(0);
  });
});
