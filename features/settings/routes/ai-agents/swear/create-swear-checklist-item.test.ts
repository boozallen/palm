import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import createSwearChecklistItem from '@/features/settings/dal/ai-agents/swear/createSwearChecklistItem';

jest.mock('@/features/settings/dal/ai-agents/swear/createSwearChecklistItem');

const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
const mockInput = {
  aiAgentId: mockAgentId,
  category: 'Preliminary Information',
  item: 'Have you identified the jurisdiction?',
  sortOrder: 1,
};

const mockChecklistItem = {
  ...mockInput,
  id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
};

describe('createSwearChecklistItem route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (createSwearChecklistItem as jest.Mock).mockResolvedValue(mockChecklistItem);

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return checklist item if user is Admin', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.createSwearChecklistItem(mockInput);

    expect(result).toEqual(mockChecklistItem);

    expect(createSwearChecklistItem).toHaveBeenCalled();
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.createSwearChecklistItem(mockInput)).rejects.toThrow();

    expect(createSwearChecklistItem).not.toHaveBeenCalled();
  });

  it('should handle errors from createSwearChecklistItem', async () => {
    const mockDalError = new Error('Database error');
    (createSwearChecklistItem as jest.Mock).mockRejectedValue(mockDalError);

    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.createSwearChecklistItem(mockInput)).rejects.toThrow();

    expect(createSwearChecklistItem).toHaveBeenCalled();
  });
});
