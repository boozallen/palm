import { UserRole } from '@/features/shared/types/user';

const mockSearchArtifacts = jest.fn();
jest.mock('@/features/context-studio/dal/searchArtifacts', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSearchArtifacts(...args),
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

describe('search-artifacts route', () => {
  let routeHandler: (opts: { input: Record<string, unknown>; ctx: { userId: string; userRole: string } }) => Promise<unknown>;

  beforeAll(async () => {
    const { procedure } = await import('@/server/trpc');
    await import('./search-artifacts');
    routeHandler = (procedure.input as jest.Mock).mock.results[0]?.value?.query?.mock?.calls?.[0]?.[0]
      ?? (procedure as unknown as { query: jest.Mock }).query.mock.calls[0][0];
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

    expect(mockSearchArtifacts).not.toHaveBeenCalled();
  });

  it('passes the restricted userId from scopeStudioQuery to the DAL, not the raw input', async () => {
    mockScopeStudioQuery.mockResolvedValue({ isLead: false, restrictedUserId: 'member-1' });
    mockSearchArtifacts.mockResolvedValue({ records: [], totalCount: 0, typeCounts: {} });

    await routeHandler({
      input: { page: 1, pageSize: 20, userGroupId: 'group-1', userId: 'all' },
      ctx: { userId: 'member-1', userRole: UserRole.User },
    });

    expect(mockSearchArtifacts).toHaveBeenCalledWith({
      page: 1, pageSize: 20, userGroupId: 'group-1', userId: 'member-1',
    });
  });

  it('should call the searchArtifacts DAL for admin users', async () => {
    const mockResult = {
      records: [
        {
          id: 'artifact-1',
          name: 'Report.html',
          source: 'chat',
          userName: 'Test User',
          workflowName: null,
          createdAt: new Date('2026-06-01'),
          cost: 0.02,
          tokens: 1500,
          cumulativeCost: 0.05,
          cumulativeTokens: 4000,
          sizeBytes: 1024,
        },
      ],
      totalCount: 1,
      typeCounts: { '.html': 1 },
    };
    mockSearchArtifacts.mockResolvedValue(mockResult);

    const result = await routeHandler({
      input: { page: 1, pageSize: 20, search: 'report' },
      ctx: { userId: 'admin-1', userRole: UserRole.Admin },
    });

    expect(mockSearchArtifacts).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: 'report', userId: 'all' });
    expect(result).toEqual(mockResult);
  });
});
