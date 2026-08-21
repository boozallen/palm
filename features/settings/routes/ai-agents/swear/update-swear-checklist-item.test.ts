import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import updateSwearChecklistItem from '@/features/settings/dal/ai-agents/swear/updateSwearChecklistItem';

jest.mock('@/features/settings/dal/ai-agents/swear/updateSwearChecklistItem');

const mockItemId = '10e0eba0-b782-491b-b609-b5c84cb0e17a';
const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';

const mockInput = {
  id: mockItemId,
  category: 'Preliminary Information',
  item: 'Updated checklist item text',
  sortOrder: 2,
};

const mockUpdatedItem = {
  ...mockInput,
  aiAgentId: mockAgentId,
};

describe('updateSwearChecklistItem route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (updateSwearChecklistItem as jest.Mock).mockResolvedValue(mockUpdatedItem);

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return updated item if user is Admin', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.updateSwearChecklistItem(mockInput);

    expect(result).toEqual(mockUpdatedItem);

    expect(updateSwearChecklistItem).toHaveBeenCalledWith(mockInput);
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.updateSwearChecklistItem(mockInput)).rejects.toThrow();

    expect(updateSwearChecklistItem).not.toHaveBeenCalled();
  });

  it('should handle errors from updateSwearChecklistItem', async () => {
    const mockDalError = new Error('Database error');
    (updateSwearChecklistItem as jest.Mock).mockRejectedValue(mockDalError);

    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.updateSwearChecklistItem(mockInput)).rejects.toThrow();

    expect(updateSwearChecklistItem).toHaveBeenCalled();
  });
});
