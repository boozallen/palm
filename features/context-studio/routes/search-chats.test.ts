import { UserRole } from '@/features/shared/types/user';

const mockSearchChats = jest.fn();
jest.mock('@/features/context-studio/dal/searchChats', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSearchChats(...args),
}));

jest.mock('@/server/trpc', () => ({
  procedure: {
    input: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation((handler) => handler),
  },
}));

jest.mock('@/features/shared/errors/routeErrors', () => ({
  Forbidden: jest.fn((msg: string) => new Error(msg)),
}));

type OutputSchema = {
  parse: (value: unknown) => { records: { messages: { usageSteps: unknown[] }[] }[] };
};

describe('search-chats route', () => {
  let routeHandler: (opts: { input: Record<string, unknown>; ctx: { userRole: string } }) => Promise<unknown>;
  // Captured at import time — beforeEach clears the recorded mock calls.
  let outputSchema: OutputSchema;

  beforeAll(async () => {
    const { procedure } = await import('@/server/trpc');
    await import('./search-chats');
    routeHandler = (procedure.input as jest.Mock).mock.results[0]?.value?.query?.mock?.calls?.[0]?.[0]
      ?? (procedure as unknown as { query: jest.Mock }).query.mock.calls[0][0];
    outputSchema = (procedure.output as jest.Mock).mock.calls[0][0] as OutputSchema;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw Forbidden for non-admin users', async () => {
    const mockResult = { records: [], totalCount: 0 };
    mockSearchChats.mockResolvedValue(mockResult);

    await expect(
      routeHandler({ input: { page: 1, pageSize: 20 }, ctx: { userRole: UserRole.User } }),
    ).rejects.toThrow('You do not have permission to access this resource');
  });

  it('should call searchChats DAL for admin users', async () => {
    const mockResult = { records: [], totalCount: 0 };
    mockSearchChats.mockResolvedValue(mockResult);

    const result = await routeHandler({
      input: { page: 1, pageSize: 20, search: 'test' },
      ctx: { userRole: UserRole.Admin },
    });

    expect(mockSearchChats).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: 'test' });
    expect(result).toEqual(mockResult);
  });

  // The output schema strips keys it does not declare, so a field the DAL
  // returns but the schema omits vanishes silently in transit.
  it('should preserve cost and tokens on usage steps through the output schema', () => {
    const parsed = outputSchema.parse({
      records: [{
        id: 'chat-1',
        userName: 'Test User',
        userEmail: 'test@example.com',
        summary: 'Summary',
        createdAt: new Date('2026-08-03T14:46:29Z'),
        documents: [],
        graphDocuments: [],
        attachedDocuments: [],
        artifacts: [],
        artifactDetails: [],
        messages: [{
          role: 'assistant',
          content: 'Hi',
          createdAt: new Date('2026-08-03T14:46:29Z'),
          usageSteps: [{ stepLabel: 'plan', cost: 0, tokens: 13941 }],
        }],
        graphAnchorCitations: 0,
      }],
      totalCount: 1,
    });

    expect(parsed.records[0].messages[0].usageSteps).toEqual([
      { stepLabel: 'plan', cost: 0, tokens: 13941 },
    ]);
  });
});
