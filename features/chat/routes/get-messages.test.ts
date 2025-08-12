import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import chatRouter from '@/features/chat/routes';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';

jest.mock('@/features/chat/dal/getMessages');
jest.mock('@/features/chat/dal/getChat');

const mockUserId = '570e3594-0ff3-475d-9ee0-4be261e6b8db';
const mockChatId = 'fcc14cff-37ba-42bb-8d83-c5618d25acd3';

const mockGetChatResolvedValue = {
  id: mockChatId,
  userId: mockUserId,
  modelId: '552079c8-53aa-4614-92fb-8eb5780eea4e',
  promptId: null,
  summary: 'Chat summary',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockGetMessagesResolvedValue = [
  {
    id: 'b96e13a2-08fb-4d9f-bdf7-4419ca5d42b5',
    chatId: mockChatId,
    role: 'User',
    content: 'What is the best color?',
    createdAt: new Date(),
    citations: [],
    artifacts: [],
  },
  {
    id: '70a17cbc-7eab-40d0-9e1e-ed1b72e9eb35',
    chatId: mockChatId,
    role: 'Assistant',
    content: 'This is the AI response',
    createdAt: new Date(),
    citations: [],
    artifacts: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        fileExtension: 'txt',
        label: 'Sample Artifact',
        content: 'Artifact content here',
        chatMessageId: '70a17cbc-7eab-40d0-9e1e-ed1b72e9eb35',
        createdAt: new Date(),
      },
    ],
  },
];

describe('getMessages procedure', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getChat as jest.Mock).mockResolvedValue(mockGetChatResolvedValue);
    (getMessages as jest.Mock).mockResolvedValue(mockGetMessagesResolvedValue);

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      logger: logger,
    } as unknown as ContextType;
  });

  it('returns the chat messages successfully with artifacts', async () => {
    const input = { chatId: mockChatId };
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.getMessages(input);

    expect(result).toEqual({
      chatId: mockChatId,
      messages: mockGetMessagesResolvedValue.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messagedAt: msg.createdAt,
        citations: msg.citations,
        artifacts: msg.artifacts,
      })),
    });
  });

  it('throws error if user does not own chat and is not an admin', async () => {
    ctx.userId = 'some-other-user-id';
    const input = { chatId: mockChatId };
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.getMessages(input)).rejects.toThrow('You do not have permission to view messages from this chat');

    expect(logger.error).toHaveBeenCalledWith(
      `You do not have permission to view messages from this chat: userId: ${ctx.userId}, chatId: ${mockChatId}`
    );
  });

  it('returns messages if user is an admin', async () => {
    ctx.userRole = UserRole.Admin;
    ctx.userId = 'some-other-user-id';
    const input = { chatId: mockChatId };
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.getMessages(input);

    expect(result).toEqual({
      chatId: mockChatId,
      messages: mockGetMessagesResolvedValue.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messagedAt: msg.createdAt,
        citations: msg.citations,
        artifacts: msg.artifacts,
      })),
    });
  });

  it('throws error if messages retrieval fails', async () => {
    (getMessages as jest.Mock).mockRejectedValue(new Error('Database error'));
    const input = { chatId: mockChatId };
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.getMessages(input)).rejects.toThrow('Database error');
  });
});
