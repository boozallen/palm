import { UserRole } from '@/features/shared/types/user';

const mockSearchWorkflowArtifacts = jest.fn();
jest.mock('@/features/context-studio/dal/searchWorkflowArtifacts', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSearchWorkflowArtifacts(...args),
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

describe('search-workflow-artifacts route', () => {
  let routeHandler: (opts: { input: Record<string, unknown>; ctx: { userRole: string } }) => Promise<unknown>;

  beforeAll(async () => {
    const { procedure } = await import('@/server/trpc');
    await import('./search-workflow-artifacts');
    routeHandler = (procedure.input as jest.Mock).mock.results[0]?.value?.query?.mock?.calls?.[0]?.[0]
      ?? (procedure as unknown as { query: jest.Mock }).query.mock.calls[0][0];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw Forbidden for non-admin users', async () => {
    mockSearchWorkflowArtifacts.mockResolvedValue({ records: [], totalCount: 0 });

    await expect(
      routeHandler({ input: { page: 1, pageSize: 20 }, ctx: { userRole: UserRole.User } }),
    ).rejects.toThrow('You do not have permission to access this resource');

    expect(mockSearchWorkflowArtifacts).not.toHaveBeenCalled();
  });

  it('should call the searchWorkflowArtifacts DAL for admin users', async () => {
    const mockResult = {
      records: [
        {
          id: 'artifact-1',
          name: 'Report.html',
          workflowName: 'Monthly Report',
          userName: 'Test User',
          createdAt: new Date('2026-06-01'),
          cost: 0.02,
          tokens: 1500,
          cumulativeCost: 0.05,
          cumulativeTokens: 4000,
        },
      ],
      totalCount: 1,
    };
    mockSearchWorkflowArtifacts.mockResolvedValue(mockResult);

    const result = await routeHandler({
      input: { page: 1, pageSize: 20, search: 'report' },
      ctx: { userRole: UserRole.Admin },
    });

    expect(mockSearchWorkflowArtifacts).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: 'report' });
    expect(result).toEqual(mockResult);
  });
});
