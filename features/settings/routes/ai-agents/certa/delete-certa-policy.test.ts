import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import deleteCertaPolicy from '@/features/settings/dal/ai-agents/certa/deleteCertaPolicy';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/ai-agents/certa/deleteCertaPolicy', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('deleteCertaPolicy route', () => {
  const policyId = '8e9a6aab-15ad-4c30-ab10-bdbd3df52150';
  const aiAgentId = '123e4567-e89b-12d3-a456-426614174000';

  const mockedResult = {
    id: policyId,
    aiAgentId: aiAgentId,
  };

  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (deleteCertaPolicy as jest.Mock).mockResolvedValue(mockedResult);

    mockCtx = {
      userId: 'test-user-id',
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should delete CERTA policy if user is admin', async () => {
    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.deleteCertaPolicy({ policyId });

    expect(deleteCertaPolicy).toHaveBeenCalledWith(policyId);
    expect(result).toEqual({
      id: policyId,
      aiAgentId: aiAgentId,
    });
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.deleteCertaPolicy({ policyId })).rejects.toThrow(
      Forbidden('You do not have permission to access this resource')
    );

    expect(deleteCertaPolicy).not.toHaveBeenCalled();
  });

  it('should handle errors from deleteCertaPolicy', async () => {
    mockCtx.userRole = UserRole.Admin;
    const mockDbError = new Error('Database error');
    (deleteCertaPolicy as jest.Mock).mockRejectedValueOnce(mockDbError);

    const caller = settingsRouter.createCaller(mockCtx);
    await expect(caller.deleteCertaPolicy({ policyId })).rejects.toThrow(
      'Database error'
    );

    expect(deleteCertaPolicy).toHaveBeenCalledWith(policyId);
  });
});
