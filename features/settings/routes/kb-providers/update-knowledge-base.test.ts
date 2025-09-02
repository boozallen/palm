import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes/index';
import updateKnowledgeBase from '@/features/settings/dal/kb-providers/updateKnowledgeBase';
import {
  Forbidden,
  InternalServerError,
} from '@/features/shared/errors/routeErrors';

jest.mock('@/features/settings/dal/kb-providers/updateKnowledgeBase');

describe('updateKnowledgeBaseRoute', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';

  const mockInput = {
    id: 'abcdd2cf-c867-4a81-b940-d22d98544a0c',
    label: 'New Knowledge Base',
    externalId: 'New External Id',
  };

  const ctx = {
    userId: mockUserId,
    userRole: UserRole.Admin,
  } as unknown as ContextType;

  const mockReturnValue = {
    id: mockInput.id,
    label: mockInput.label,
    externalId: mockInput.externalId,
    kbProviderId: 'abcdd2cf-c867-4a81-b940-d22d98544a0d',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update knowledge base if user is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    (updateKnowledgeBase as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateKnowledgeBase(mockInput)).resolves.toEqual(
      mockReturnValue
    );

    expect(updateKnowledgeBase).toBeCalledWith(mockInput);
  });

  it('should not update knowledge base if user is not an Admin', async () => {
    ctx.userRole = UserRole.User;

    const mockError = Forbidden(
      'You do not have permission to update knowledge base'
    );

    (updateKnowledgeBase as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateKnowledgeBase(mockInput)).rejects.toThrow(
      mockError
    );

    expect(updateKnowledgeBase).not.toHaveBeenCalled();
  });

  it('should throw error if there are no values', async () => {
    ctx.userRole = UserRole.Admin;

    (updateKnowledgeBase as jest.Mock).mockRejectedValueOnce(
      InternalServerError('Error updating knowledge base')
    );

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.updateKnowledgeBase(mockInput)).rejects.toThrow(
      new Error('Error updating knowledge base')
    );

    expect(updateKnowledgeBase).toBeCalledWith(mockInput);
  });
});
