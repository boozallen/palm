import getUserProvidedGraphDocuments from './getUserProvidedGraphDocuments';
import db from '@/server/db';
import { tryParsePalmGraph } from '@/features/graph-database/services/jsonIngest/detectPalmGraph';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { document: { findMany: jest.fn() } },
}));
jest.mock('@/features/graph-database/services/jsonIngest/detectPalmGraph');

const mockFindMany = (db as unknown as { document: { findMany: jest.Mock } }).document.findMany;
const mockParse = tryParsePalmGraph as jest.Mock;

describe('getUserProvidedGraphDocuments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns ids of .json docs whose text parses as a palm-graph', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'graph-doc', text: '{"valid":true}' },
      { id: 'plain-json', text: 'not a graph' },
    ]);
    mockParse.mockImplementation((text: string) => (text === '{"valid":true}' ? { entities: [] } : null));

    const result = await getUserProvidedGraphDocuments('user-1');

    expect(result).toEqual(['graph-doc']);
  });

  it('scopes the query to .json docs the user can access', async () => {
    mockFindMany.mockResolvedValue([]);
    mockParse.mockReturnValue(null);

    await getUserProvidedGraphDocuments('user-1');

    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.filename).toEqual({ endsWith: '.json', mode: 'insensitive' });
    expect(where.OR).toEqual([
      { userId: 'user-1' },
      { adminCreated: true, accessUsers: { some: { id: 'user-1' } } },
    ]);
  });
});
