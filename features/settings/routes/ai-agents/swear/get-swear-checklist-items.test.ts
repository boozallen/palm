import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import getSwearChecklistItems from '@/features/settings/dal/ai-agents/swear/getSwearChecklistItems';

jest.mock('@/features/settings/dal/ai-agents/swear/getSwearChecklistItems');

const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';

const mockChecklistItems = [
  {
    id: '10e0eba0-b782-491b-b609-b5c84cb0e17a',
    aiAgentId: mockAgentId,
    category: 'Preliminary Information',
    item: 'Have you identified the jurisdiction?',
    sortOrder: 1,
  },
  {
    id: '20e0eba0-b782-491b-b609-b5c84cb0e17b',
    aiAgentId: mockAgentId,
    category: 'Probable Cause',
    item: 'Have you indicated the basis of your knowledge?',
    sortOrder: 1,
  },
];

describe('getSwearChecklistItems route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getSwearChecklistItems as jest.Mock).mockResolvedValue(mockChecklistItems);

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return checklist items if user is Admin', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getSwearChecklistItems({ id: mockAgentId });

    expect(result).toEqual({ checklistItems: mockChecklistItems });

    expect(getSwearChecklistItems).toHaveBeenCalledWith(mockAgentId);
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getSwearChecklistItems({ id: mockAgentId })).rejects.toThrow();

    expect(getSwearChecklistItems).not.toHaveBeenCalled();
  });

  it('should handle errors from getSwearChecklistItems', async () => {
    const mockDalError = new Error('Database error');
    (getSwearChecklistItems as jest.Mock).mockRejectedValue(mockDalError);

    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getSwearChecklistItems({ id: mockAgentId })).rejects.toThrow();

    expect(getSwearChecklistItems).toHaveBeenCalled();
  });

  it('should return empty array when no items found', async () => {
    (getSwearChecklistItems as jest.Mock).mockResolvedValue([]);

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getSwearChecklistItems({ id: mockAgentId });

    expect(result).toEqual({ checklistItems: [] });
  });
});
