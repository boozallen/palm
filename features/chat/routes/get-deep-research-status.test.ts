import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import { DeepResearchStatus } from '@/features/chat/types/message';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    chatMessage: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/features/chat/dal/getChat');

import chatRouter from '@/features/chat/routes';
import getChat from '@/features/chat/dal/getChat';
import db from '@/server/db';

describe('get-deep-research-status', () => {
  const mockChatId = '550e8400-e29b-41d4-a716-446655440001';
  const mockJobId = '550e8400-e29b-41d4-a716-446655440002';
  const mockMessageId = '550e8400-e29b-41d4-a716-446655440003';
  const mockUserId = '550e8400-e29b-41d4-a716-446655440004';

  const mockUserContext = {
    userId: mockUserId,
    userRole: UserRole.User,
    logger: logger,
  } as unknown as ContextType;

  const mockAdminContext = {
    userId: mockUserId,
    userRole: UserRole.Admin,
    logger: logger,
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return pending status when no message found', async () => {
    (getChat as jest.Mock).mockResolvedValue({
      id: mockChatId,
      userId: mockUserId,
    });

    (db.chatMessage.findFirst as jest.Mock).mockResolvedValue(null);

    const input = {
      chatId: mockChatId,
      jobId: mockJobId,
      messageId: mockMessageId,
    };

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.getDeepResearchStatus(input);

    expect(result).toEqual({ status: DeepResearchStatus.PENDING });
    expect(db.chatMessage.findFirst).toHaveBeenCalledWith({ where: { deepResearchJobId: mockJobId } });
  });

  it('should return active status when job is active', async () => {
    (getChat as jest.Mock).mockResolvedValue({
      id: mockChatId,
      userId: mockUserId,
    });

    (db.chatMessage.findFirst as jest.Mock).mockResolvedValue({
      id: mockMessageId,
      deepResearchStatus: DeepResearchStatus.PENDING,
    });

    const input = {
      chatId: mockChatId,
      jobId: mockJobId,
      messageId: mockMessageId,
    };

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.getDeepResearchStatus(input);

    expect(result).toEqual({ status: DeepResearchStatus.PENDING });
  });

  it('should return completed status for completed job', async () => {
    (getChat as jest.Mock).mockResolvedValue({
      id: mockChatId,
      userId: mockUserId,
    });

    (db.chatMessage.findFirst as jest.Mock).mockResolvedValue({
      id: mockMessageId,
      deepResearchStatus: DeepResearchStatus.COMPLETED,
    });

    const input = {
      chatId: mockChatId,
      jobId: mockJobId,
      messageId: mockMessageId,
    };

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.getDeepResearchStatus(input);

    expect(result).toEqual({ 
      status: DeepResearchStatus.COMPLETED,
    });
  });

  it('should return completed status without processing content', async () => {
    (getChat as jest.Mock).mockResolvedValue({
      id: mockChatId,
      userId: mockUserId,
    });

    (db.chatMessage.findFirst as jest.Mock).mockResolvedValue({
      id: mockMessageId,
      deepResearchStatus: DeepResearchStatus.COMPLETED,
    });

    const input = {
      chatId: mockChatId,
      jobId: mockJobId,
      messageId: mockMessageId,
    };

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.getDeepResearchStatus(input);

    expect(result).toEqual({ 
      status: DeepResearchStatus.COMPLETED,
    });
  });

  it('should return failed status', async () => {
    (getChat as jest.Mock).mockResolvedValue({
      id: mockChatId,
      userId: mockUserId,
    });

    (db.chatMessage.findFirst as jest.Mock).mockResolvedValue({
      id: mockMessageId,
      deepResearchStatus: DeepResearchStatus.FAILED,
    });

    const input = {
      chatId: mockChatId,
      jobId: mockJobId,
      messageId: mockMessageId,
    };

    const caller = chatRouter.createCaller(mockUserContext);
    const result = await caller.getDeepResearchStatus(input);

    expect(result).toEqual({ 
      status: DeepResearchStatus.FAILED,
    });
  });

  it('should throw Forbidden error when user does not have permission', async () => {
    (getChat as jest.Mock).mockResolvedValue({
      id: mockChatId,
      userId: 'different-user',
    });

    const input = {
      chatId: mockChatId,
      jobId: mockJobId,
      messageId: mockMessageId,
    };

    const caller = chatRouter.createCaller(mockUserContext);
    await expect(caller.getDeepResearchStatus(input)).rejects.toThrow('You do not have permission to access this chat');
  });

  it('should allow admin access to any chat', async () => {
    (getChat as jest.Mock).mockResolvedValue({
      id: mockChatId,
      userId: 'different-user',
    });

    (db.chatMessage.findFirst as jest.Mock).mockResolvedValue(null);

    const input = {
      chatId: mockChatId,
      jobId: mockJobId,
      messageId: mockMessageId,
    };

    const caller = chatRouter.createCaller(mockAdminContext);
    const result = await caller.getDeepResearchStatus(input);

    expect(result).toEqual({ status: DeepResearchStatus.PENDING });
  });
});
