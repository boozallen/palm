import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import updateCertaPolicy from '@/features/settings/dal/ai-agents/certa/updateCertaPolicy';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/ai-agents/certa/updateCertaPolicy', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('updateCertaPolicy route', () => {
  const policyId = '8e9a6aab-15ad-4c30-ab10-bdbd3df52150';
  const aiAgentId = '123e4567-e89b-12d3-a456-426614174000';

  const policyInput = {
    id: policyId,
    title: 'Updated Policy Title',
    content: 'Updated Policy Content',
    requirements: 'Updated Requirements',
  };

  const mockedResult = {
    id: policyId,
    title: policyInput.title,
    content: policyInput.content,
    requirements: policyInput.requirements,
    aiAgentId: aiAgentId,
  };

  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (updateCertaPolicy as jest.Mock).mockResolvedValue(mockedResult);

    mockCtx = {
      userId: 'test-user-id',
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should update CERTA policy if user is admin', async () => {
    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.updateCertaPolicy(policyInput);

    expect(updateCertaPolicy).toHaveBeenCalledWith(policyInput);
    expect(result).toEqual(mockedResult);
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.updateCertaPolicy(policyInput)).rejects.toThrow(
      Forbidden('You do not have permission to update a policy')
    );

    expect(updateCertaPolicy).not.toHaveBeenCalled();
  });

  it('should handle errors from updateCertaPolicy', async () => {
    mockCtx.userRole = UserRole.Admin;

    const mockDbError = new Error('Database error');
    (updateCertaPolicy as jest.Mock).mockRejectedValueOnce(mockDbError);

    const caller = settingsRouter.createCaller(mockCtx);
    await expect(caller.updateCertaPolicy(policyInput)).rejects.toThrow(
      'Database error'
    );

    expect(updateCertaPolicy).toHaveBeenCalledWith(policyInput);
  });
});
