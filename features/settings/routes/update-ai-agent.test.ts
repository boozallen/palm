import { UserRole } from '@/features/shared/types/user';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import updateAiAgent from '@/features/settings/dal/updateAiAgent';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/settings/dal/updateAiAgent');

describe('updateAiAgent route', () => {
  const mockAgent = {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    name: 'Agent 1',
    description: 'Description 1',
    enabled: true,
  };

  const mockInput = {
    id: mockAgent.id,
    enabled: false,
  };

  const mockError = Forbidden('You do not have permission to access this resource.');

  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (updateAiAgent as jest.Mock).mockImplementation(() => Promise.resolve(mockAgent));
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should update an agent if user is Admin', async () => {
    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    const result = await caller.updateAiAgent(mockInput);

    expect(result).toEqual({
      aiAgent: mockAgent,
    });

    expect(updateAiAgent).toHaveBeenCalledWith(mockInput.id, mockInput.enabled);
  });

  it('should throw an error if user is not Admin', async () => {
    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.updateAiAgent(mockInput)).rejects.toThrow(mockError);

    expect(updateAiAgent).not.toHaveBeenCalled();
  });

  it('should handle errors from updateAiAgent', async () => {
    const mockDbError = new Error('Database error');
    (updateAiAgent as jest.Mock).mockRejectedValue(mockDbError);

    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.updateAiAgent(mockInput)).rejects.toThrow('Database error');

    expect(updateAiAgent).toHaveBeenCalled();
  });
});
