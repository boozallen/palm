import { UserRole } from '@/features/shared/types/user';

const mockSearchChats = jest.fn();
jest.mock('@/features/context-studio/dal/searchChats', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSearchChats(...args),
}));

const mockScopeStudioQuery = jest.fn();
jest.mock('@/features/context-studio/services/scopeStudioQuery', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockScopeStudioQuery(...args),
}));

jest.mock('@/server/trpc', () => ({
  procedure: {
    input: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation((handler) => handler),
  },
}));

type OutputSchema = {
  parse: (value: unknown) => {
    records: {
      messages: { usageSteps: unknown[] }[];
      sessionLength: { totalDurationMs: number; visits: unknown[] } | null;
    }[];
  };
};

describe('search-chats route', () => {
  let routeHandler: (opts: { input: Record<string, unknown>; ctx: { userId: string; userRole: string } }) => Promise<unknown>;
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
    mockScopeStudioQuery.mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('throws and never calls the DAL when scopeStudioQuery rejects the caller', async () => {
    mockScopeStudioQuery.mockRejectedValue(new Error('You do not have permission to access this resource'));

    await expect(
      routeHandler({ input: { page: 1, pageSize: 20 }, ctx: { userId: 'user-1', userRole: UserRole.User } }),
    ).rejects.toThrow('You do not have permission to access this resource');

    expect(mockSearchChats).not.toHaveBeenCalled();
  });

  it('calls the DAL with the raw filters when unrestricted', async () => {
    const mockResult = { records: [], totalCount: 0 };
    mockSearchChats.mockResolvedValue(mockResult);

    const result = await routeHandler({
      input: { page: 1, pageSize: 20, search: 'test', userGroupId: 'group-1', userId: 'all' },
      ctx: { userId: 'admin-1', userRole: UserRole.Admin },
    });

    expect(mockScopeStudioQuery).toHaveBeenCalledWith(
      { userId: 'admin-1', userRole: UserRole.Admin }, 'group-1', 'all',
    );
    expect(mockSearchChats).toHaveBeenCalledWith({
      page: 1, pageSize: 20, search: 'test', userGroupId: 'group-1', userId: 'all',
    });
    expect(result).toEqual(mockResult);
  });

  it('passes the restricted userId from scopeStudioQuery to the DAL, not the raw input', async () => {
    mockScopeStudioQuery.mockResolvedValue({ isLead: false, restrictedUserId: 'member-1' });
    const mockResult = { records: [], totalCount: 0 };
    mockSearchChats.mockResolvedValue(mockResult);

    await routeHandler({
      input: { page: 1, pageSize: 20, userGroupId: 'group-1', userId: 'all' },
      ctx: { userId: 'member-1', userRole: UserRole.User },
    });

    expect(mockSearchChats).toHaveBeenCalledWith({
      page: 1, pageSize: 20, userGroupId: 'group-1', userId: 'member-1',
    });
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
        sessionLength: null,
      }],
      totalCount: 1,
      artifactsGeneratedCount: 0,
      citedDocumentsCount: 0,
      documentCitationsCount: 0,
      graphAnchorCitationsCount: 0,
    });

    expect(parsed.records[0].messages[0].usageSteps).toEqual([
      { stepLabel: 'plan', cost: 0, tokens: 13941 },
    ]);
  });

  it('should preserve session length visits through the output schema', () => {
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
        messages: [],
        graphAnchorCitations: 0,
        sessionLength: {
          totalDurationMs: 300_000,
          visits: [{
            enteredAt: new Date('2026-08-03T14:46:29Z'),
            leftAt: new Date('2026-08-03T14:51:29Z'),
            durationMs: 300_000,
          }],
        },
      }],
      totalCount: 1,
      artifactsGeneratedCount: 0,
      citedDocumentsCount: 0,
      documentCitationsCount: 0,
      graphAnchorCitationsCount: 0,
    });

    expect(parsed.records[0].sessionLength).toEqual({
      totalDurationMs: 300_000,
      visits: [{
        enteredAt: new Date('2026-08-03T14:46:29Z'),
        leftAt: new Date('2026-08-03T14:51:29Z'),
        durationMs: 300_000,
      }],
    });
  });
});
