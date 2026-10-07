import { UserRole } from '@/features/shared/types/user';

const mockSearchDocuments = jest.fn();
jest.mock('@/features/context-studio/dal/searchDocuments', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSearchDocuments(...args),
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

describe('search-documents route', () => {
  let routeHandler: (opts: { input: Record<string, unknown>; ctx: { userId: string; userRole: string } }) => Promise<unknown>;

  beforeAll(async () => {
    const { procedure } = await import('@/server/trpc');
    await import('./search-documents');
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

    expect(mockSearchDocuments).not.toHaveBeenCalled();
  });

  it('calls the DAL with the raw filters when unrestricted', async () => {
    const mockResult = { records: [], totalCount: 0 };
    mockSearchDocuments.mockResolvedValue(mockResult);

    const result = await routeHandler({
      input: { page: 1, pageSize: 20, search: 'report', userGroupId: 'group-1', userId: 'all' },
      ctx: { userId: 'admin-1', userRole: UserRole.Admin },
    });

    expect(mockScopeStudioQuery).toHaveBeenCalledWith(
      { userId: 'admin-1', userRole: UserRole.Admin }, 'group-1', 'all',
    );
    expect(mockSearchDocuments).toHaveBeenCalledWith({
      page: 1, pageSize: 20, search: 'report', userGroupId: 'group-1', userId: 'all',
    });
    expect(result).toEqual(mockResult);
  });

  it('passes the restricted userId from scopeStudioQuery to the DAL, not the raw input', async () => {
    mockScopeStudioQuery.mockResolvedValue({ isLead: false, restrictedUserId: 'member-1' });
    const mockResult = { records: [], totalCount: 0 };
    mockSearchDocuments.mockResolvedValue(mockResult);

    await routeHandler({
      input: { page: 1, pageSize: 20, userGroupId: 'group-1', userId: 'all' },
      ctx: { userId: 'member-1', userRole: UserRole.User },
    });

    expect(mockSearchDocuments).toHaveBeenCalledWith({
      page: 1, pageSize: 20, userGroupId: 'group-1', userId: 'member-1',
    });
  });
});
