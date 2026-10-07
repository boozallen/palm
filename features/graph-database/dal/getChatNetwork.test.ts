import { getGraphDatabaseSource } from '@/features/graph-database';
import { getChatNetwork } from '@/features/graph-database/dal/getChatNetwork';

jest.mock('@/features/graph-database');

describe('getChatNetwork conversation isolation', () => {
  it('returns no conversation nodes for a document-scoped read', async () => {
    const documentIds = ['doc-1'];
    const graphNodes = [
      { id: 1, labels: ['Entity'], properties: { id: 'entity-1', documentId: 'doc-1' } },
      { id: 2, labels: ['Message'], properties: { id: 'message-1' } },
      { id: 3, labels: ['Chat'], properties: { id: 'chat-1' } },
      { id: 4, labels: ['Artifact'], properties: { id: 'artifact-1' } },
    ];
    const scopedNodes = graphNodes.filter(({ properties }) => (
      'documentId' in properties && documentIds.includes(properties.documentId as string)
    ));
    const run = jest.fn()
      .mockResolvedValueOnce({
        records: scopedNodes.map((node) => ({
          get: (field: string) => ({
            nId: node.id,
            nLabels: node.labels,
            nProperties: node.properties,
            r: null,
            m: null,
          })[field],
        })),
      })
      .mockResolvedValueOnce({ records: [] });
    (getGraphDatabaseSource as jest.Mock).mockResolvedValue({ run });

    const result = await getChatNetwork({ documentIds });

    const labels = result.nodes.flatMap((node) => node.labels);
    expect(labels).not.toContain('Chat');
    expect(labels).not.toContain('Message');
    expect(labels).not.toContain('Artifact');
    expect(result.nodes).toHaveLength(1);
  });
});
