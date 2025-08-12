import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import createCertaPolicy from '@/features/settings/dal/ai-agents/certa/createCertaPolicy';

jest.mock('@/features/settings/dal/ai-agents/certa/createCertaPolicy');

const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
const mockInput = {
  aiAgentId: mockAgentId,
  title: 'Policy 1',
  content: 'Policy 1 content',
  requirements: 'Policy 1 requirements',
};

const mockPolicy = {
  ...mockInput,
  id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
};

describe('createCertaPolicy route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (createCertaPolicy as jest.Mock).mockResolvedValue(mockPolicy);

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return policy if user is Admin', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.createCertaPolicy(mockInput);

    expect(result).toEqual(mockPolicy);

    expect(createCertaPolicy).toHaveBeenCalled();
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.createCertaPolicy(mockInput)).rejects.toThrow();

    expect(createCertaPolicy).not.toHaveBeenCalled();
  });

  it('should handle errors from getCertaPolicy', async () => {
    const mockDalError = new Error('Database error');
    (createCertaPolicy as jest.Mock).mockRejectedValue(mockDalError);

    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.createCertaPolicy(mockInput)).rejects.toThrow();

    expect(createCertaPolicy).toHaveBeenCalled();
  });
});
