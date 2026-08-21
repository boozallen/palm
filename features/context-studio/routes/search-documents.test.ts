import { UserRole } from '@/features/shared/types/user';

const mockSearchDocuments = jest.fn();
jest.mock('@/features/context-studio/dal/searchDocuments', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSearchDocuments(...args),
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

describe('search-documents route', () => {
  let routeHandler: (opts: { input: Record<string, unknown>; ctx: { userRole: string } }) => Promise<unknown>;

  beforeAll(async () => {
    const { procedure } = await import('@/server/trpc');
    await import('./search-documents');
    routeHandler = (procedure.input as jest.Mock).mock.results[0]?.value?.query?.mock?.calls?.[0]?.[0]
      ?? (procedure as unknown as { query: jest.Mock }).query.mock.calls[0][0];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw Forbidden for non-admin users', async () => {
    const mockResult = { records: [], totalCount: 0 };
    mockSearchDocuments.mockResolvedValue(mockResult);

    await expect(
      routeHandler({ input: { page: 1, pageSize: 20 }, ctx: { userRole: UserRole.User } }),
    ).rejects.toThrow('You do not have permission to access this resource');
  });

  it('should call searchDocuments DAL for admin users', async () => {
    const mockResult = { records: [], totalCount: 0 };
    mockSearchDocuments.mockResolvedValue(mockResult);

    const result = await routeHandler({
      input: { page: 1, pageSize: 20, search: 'report' },
      ctx: { userRole: UserRole.Admin },
    });

    expect(mockSearchDocuments).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: 'report' });
    expect(result).toEqual(mockResult);
  });
});
