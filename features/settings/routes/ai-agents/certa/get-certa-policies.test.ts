import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import getCertaPolicies from '@/features/settings/dal/ai-agents/certa/getCertaPolicies';
import logger from '@/server/logger';

jest.mock('@/features/settings/dal/ai-agents/certa/getCertaPolicies');

const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
const mockPolicies = [
  {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    aiAgentId: mockAgentId,
    title: 'Policy 1',
    content: 'Policy 1 content',
    requirements: 'Policy 1 requirements',
  },
  {
    id: '7e544d07-7a11-4ff1-a1e7-b07c8f36a264',
    aiAgentId: mockAgentId,
    title: 'Policy 2',
    content: 'Policy 2 content',
    requirements: 'Policy 2 requirements',
  },
];

describe('getCertaPolicies route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getCertaPolicies as jest.Mock).mockResolvedValue(mockPolicies);

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return policies if user is Admin', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getCertaPolicies({ id: mockAgentId });

    expect(result).toEqual({
      policies: mockPolicies,
    });

    expect(getCertaPolicies).toHaveBeenCalled();
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getCertaPolicies({ id: mockAgentId })).rejects.toThrow();

    expect(getCertaPolicies).not.toHaveBeenCalled();
  });

  it('should handle errors from getCertaPolicies', async () => {
    const mockDalError = new Error('Database error');
    (getCertaPolicies as jest.Mock).mockRejectedValue(mockDalError);

    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getCertaPolicies({ id: mockAgentId })).rejects.toThrow();

    expect(getCertaPolicies).toHaveBeenCalled();
  });
});
