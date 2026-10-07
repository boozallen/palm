import assignChatUseCase from './assignChatUseCase';
import getChat from '@/features/chat/dal/getChat';
import updateChatUseCase from '@/features/chat/dal/updateChatUseCase';
import { classifyChatUseCase } from '@/features/chat/system-ai/generateChatConversationSummary';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import logger from '@/server/logger';

jest.mock('@/features/ai-provider');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/updateChatUseCase');
jest.mock('@/features/chat/system-ai/generateChatConversationSummary');
jest.mock('@/features/shared/dal/getSystemConfig');

const mockChat = {
  id: 'aa356d1f-dd68-4f6b-82a9-ec9220973857',
  userId: 'ba356d1f-dd68-4f6b-82a9-ec9220973857',
  modelId: 'ca356d1f-dd68-4f6b-82a9-ec9220973857',
  promptId: null,
  agentProviderId: null,
  summary: 'Bid Staffing Plan',
  useCase: null,
  externalSessionId: null,
  userGroupId: 'da356d1f-dd68-4f6b-82a9-ec9220973857',
  createdAt: new Date('2026-09-08T10:00:00.000Z'),
  updatedAt: new Date('2026-09-08T10:00:00.000Z'),
};

const input = {
  chatId: mockChat.id,
  userMessage: 'Draft the staffing plan for the recompete bid',
  assistantMessage: 'Here is a staffing plan covering the key personnel...',
};

describe('assignChatUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSystemConfig as jest.Mock).mockResolvedValue({ featureManagementChatSummarization: true });
    (getChat as jest.Mock).mockResolvedValue(mockChat);
    (classifyChatUseCase as jest.Mock).mockResolvedValue('Proposal Capture');
  });

  it('classifies the exchange and stores the use case', async () => {
    await assignChatUseCase(input);

    expect(updateChatUseCase).toHaveBeenCalledWith({
      id: input.chatId,
      useCase: 'Proposal Capture',
    });
  });

  // Asserted on the arguments because a prompt built from the request alone still
  // returns a plausible-looking category, so nothing else here would fail.
  it('classifies from the reply as well as the request', async () => {
    await assignChatUseCase(input);

    expect(classifyChatUseCase).toHaveBeenCalledWith(
      expect.anything(),
      input.userMessage,
      input.assistantMessage,
    );
  });

  it('does nothing when the assistant produced no reply', async () => {
    await assignChatUseCase({ ...input, assistantMessage: '   ' });

    expect(classifyChatUseCase).not.toHaveBeenCalled();
    expect(updateChatUseCase).not.toHaveBeenCalled();
  });

  // Called on every completed turn, so this guard is what keeps a long conversation
  // from paying for a category it already has.
  it('does nothing when the chat is already categorized', async () => {
    (getChat as jest.Mock).mockResolvedValue({ ...mockChat, useCase: 'engineering' });

    await assignChatUseCase(input);

    expect(classifyChatUseCase).not.toHaveBeenCalled();
    expect(updateChatUseCase).not.toHaveBeenCalled();
  });

  it('does nothing when chat summarization is switched off', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({ featureManagementChatSummarization: false });

    await assignChatUseCase(input);

    expect(classifyChatUseCase).not.toHaveBeenCalled();
    expect(updateChatUseCase).not.toHaveBeenCalled();
  });

  // Null is reported as unattributed spend; defaulting to a category would be the
  // fabrication the null exists to avoid.
  it('leaves the use case unset when the model returns none', async () => {
    (classifyChatUseCase as jest.Mock).mockResolvedValue(null);

    await assignChatUseCase(input);

    expect(updateChatUseCase).not.toHaveBeenCalled();
  });

  // Runs after the user's answer is saved and on screen; not worth failing that job.
  it('swallows and logs a failure rather than throwing', async () => {
    const error = new Error('provider unavailable');
    (classifyChatUseCase as jest.Mock).mockRejectedValue(error);

    await expect(assignChatUseCase(input)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to assign a use case to a chat',
      { chatId: input.chatId, error },
    );
  });
});
