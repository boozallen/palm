import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getChatTranscript from '@/features/context-studio/dal/getChatTranscript';
import isChatInUseCaseScope from '@/features/context-studio/dal/isChatInUseCaseScope';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import { UserRole } from '@/features/shared/types/user';
import { ChatTranscriptMessage } from '@/features/context-studio/types/use-case-detail';

jest.mock('@/features/context-studio/dal/getChatTranscript');
jest.mock('@/features/context-studio/dal/isChatInUseCaseScope');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-chat-transcript route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const otherUserId = '9f1c2b3a-4d5e-6f70-8192-a3b4c5d6e7f8';
  const mockChatId = '11111111-1111-1111-1111-111111111111';
  const mockGroupId = '22222222-2222-2222-2222-222222222222';

  const mockTranscript: ChatTranscriptMessage[] = [
    {
      role: 'user',
      content: 'Write a SQL migration',
      createdAt: new Date('2026-01-01T10:00:00Z'),
      usageSteps: [],
    },
    {
      role: 'assistant',
      content: 'Here is the migration...',
      createdAt: new Date('2026-01-01T10:00:10Z'),
      usageSteps: [
        { stepLabel: 'Completion', cost: 0.05, tokens: 250 },
      ],
    },
  ];

  const input = {
    chatId: mockChatId,
    useCase: UseCase.ProposalCapture,
    timeRange: TimeRange.Month,
    userGroupId: mockGroupId,
    userId: 'all' as const,
    excludeAdmins: true,
  };

  const callerFor = (userRole: UserRole) =>
    contextStudioRouter.createCaller({
      userId: mockUserId,
      userRole,
    } as unknown as ContextType);

  beforeEach(() => {
    jest.clearAllMocks();
    (getChatTranscript as jest.Mock).mockResolvedValue(mockTranscript);
    (isChatInUseCaseScope as jest.Mock).mockResolvedValue(true);
    (scopeStudioQuery as jest.Mock).mockResolvedValue({
      isLead: true,
      restrictedUserId: 'all',
    });
  });

  it('returns the transcript for an admin', async () => {
    const response = await callerFor(UserRole.Admin).getChatTranscript(input);

    expect(response).toEqual(mockTranscript);
    expect(getChatTranscript).toHaveBeenCalledWith(mockChatId, mockGroupId);
  });

  it('returns the transcript for a group lead, who can already see the row', async () => {
    const response = await callerFor(UserRole.User).getChatTranscript(input);

    expect(response).toEqual(mockTranscript);
  });

  it('checks the chat against the scope the filters resolved to, not the raw request', async () => {
    (scopeStudioQuery as jest.Mock).mockResolvedValue({
      isLead: false,
      restrictedUserId: mockUserId,
    });

    await callerFor(UserRole.User).getChatTranscript(input);

    expect(isChatInUseCaseScope).toHaveBeenCalledWith(
      mockChatId,
      UseCase.ProposalCapture,
      TimeRange.Month,
      mockGroupId,
      mockUserId,
      true,
    );
  });

  it('refuses a chat the viewer was never shown, without confirming it exists', async () => {
    (isChatInUseCaseScope as jest.Mock).mockResolvedValue(false);

    await expect(callerFor(UserRole.User).getChatTranscript(input))
      .rejects.toThrow('Chat transcript not found');

    expect(getChatTranscript).not.toHaveBeenCalled();
  });

  it('refuses a caller the shared filter scoping rejects', async () => {
    (scopeStudioQuery as jest.Mock).mockRejectedValue(new Error('Forbidden'));

    await expect(
      callerFor(UserRole.User).getChatTranscript({ ...input, userId: otherUserId }),
    ).rejects.toThrow('Forbidden');

    expect(getChatTranscript).not.toHaveBeenCalled();
  });
});
