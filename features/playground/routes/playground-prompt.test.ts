import playgroundRoutes from '.';
import { ContextType } from '@/server/trpc-context';
import { queuePlaygroundPrompt } from '@/features/playground/services/queue-playground-prompt-service';
import { promptSubmissionErrorMessage } from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import logger from '@/server/logger';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';

jest.mock('@/features/playground/services/queue-playground-prompt-service');
jest.mock('@/features/shared/dal/isUserGroupMember');

describe('playgroundPrompt', () => {
  let mockCtx: ContextType;
  const mockinput = {
    exampleInput: 'Hello',
    config: {
      temperature: 1,
      model: 'GPT-4',
      topP: 0.12,

      frequencyPenalty: null,
      presencePenalty: null,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      ai: jest.fn(),
      userId: '6de3d2d5-1918-4288-993a-7445a2c8dbf9',
    } as unknown as ContextType;
  });

  it('should initialize', async () => {
    (queuePlaygroundPrompt as jest.Mock).mockResolvedValue({ jobId: 'job-1' });

    const caller = playgroundRoutes.createCaller(mockCtx);
    const result = await caller.playgroundPrompt({ items: [mockinput] });

    expect(result).toBeTruthy();
  });

  it('returns a jobId when the job is queued successfully', async () => {
    (queuePlaygroundPrompt as jest.Mock).mockResolvedValue({ jobId: 'job-1' });

    const caller = playgroundRoutes.createCaller(mockCtx);
    const result = await caller.playgroundPrompt({ items: [mockinput] });

    expect(result.jobId).toBe('job-1');
  });

  it('should handle any error', async () => {
    (queuePlaygroundPrompt as jest.Mock).mockRejectedValue(new Error('Error'));

    const caller = playgroundRoutes.createCaller(mockCtx);
    try {
      await caller.playgroundPrompt({ items: [mockinput] });
    } catch (error: any) {
      expect(error.message).toBe(promptSubmissionErrorMessage);
      expect(logger.error).toHaveBeenCalled();
    }
  });

  it('attributes usage to the selected group when the user is a member', async () => {
    const mockUserGroupId = 'e1b2c3d4-e5f6-7890-abcd-ef1234567891';
    (queuePlaygroundPrompt as jest.Mock).mockResolvedValue({ jobId: 'job-1' });
    (isUserGroupMember as jest.Mock).mockResolvedValue(true);

    const caller = playgroundRoutes.createCaller(mockCtx);
    const result = await caller.playgroundPrompt({ items: [mockinput], userGroupId: mockUserGroupId });

    expect(result).toBeTruthy();
    expect(isUserGroupMember).toHaveBeenCalledWith(mockCtx.userId, mockUserGroupId);
    expect(queuePlaygroundPrompt).toHaveBeenCalledWith([mockinput], mockCtx.userId, mockUserGroupId);
  });

  it('rejects a selected group the user is not a member of', async () => {
    const mockUserGroupId = 'e1b2c3d4-e5f6-7890-abcd-ef1234567891';
    (isUserGroupMember as jest.Mock).mockResolvedValue(false);

    const caller = playgroundRoutes.createCaller(mockCtx);

    await expect(
      caller.playgroundPrompt({ items: [mockinput], userGroupId: mockUserGroupId })
    ).rejects.toThrow('You are not a member of the selected group');

    expect(isUserGroupMember).toHaveBeenCalledWith(mockCtx.userId, mockUserGroupId);
    expect(queuePlaygroundPrompt).not.toHaveBeenCalled();
  });
});
