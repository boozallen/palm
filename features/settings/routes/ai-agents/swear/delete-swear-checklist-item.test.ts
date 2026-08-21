import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import deleteSwearChecklistItem from '@/features/settings/dal/ai-agents/swear/deleteSwearChecklistItem';

jest.mock('@/features/settings/dal/ai-agents/swear/deleteSwearChecklistItem');

const mockItemId = '10e0eba0-b782-491b-b609-b5c84cb0e17a';
const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';

const mockDeletedItem = {
  id: mockItemId,
  aiAgentId: mockAgentId,
};

describe('deleteSwearChecklistItem route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (deleteSwearChecklistItem as jest.Mock).mockResolvedValue(mockDeletedItem);

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return deleted item info if user is Admin', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.deleteSwearChecklistItem({ itemId: mockItemId });

    expect(result).toEqual(mockDeletedItem);

    expect(deleteSwearChecklistItem).toHaveBeenCalledWith(mockItemId);
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.deleteSwearChecklistItem({ itemId: mockItemId })).rejects.toThrow();

    expect(deleteSwearChecklistItem).not.toHaveBeenCalled();
  });

  it('should handle errors from deleteSwearChecklistItem', async () => {
    const mockDalError = new Error('Database error');
    (deleteSwearChecklistItem as jest.Mock).mockRejectedValue(mockDalError);

    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.deleteSwearChecklistItem({ itemId: mockItemId })).rejects.toThrow();

    expect(deleteSwearChecklistItem).toHaveBeenCalled();
  });
});
