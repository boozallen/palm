jest.mock('@/features/graph-database/sources/neo4j', () => {
  return {
    Neo4jSource: jest.fn().mockImplementation(() => ({
      __mocked: true,
    })),
  };
});

import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import chatRouter from '@/features/chat/routes';
import getChatMetadata from '@/features/chat/dal/getChatMetadata';

jest.mock('@/features/chat/dal/getChatMetadata');

const mockUserId = '570e3594-0ff3-475d-9ee0-4be261e6b8db';
const mockChatId = 'fcc14cff-37ba-42bb-8d83-c5618d25acd3';

const mockMetadata = [
  {
    chatId: mockChatId,
    modelName: 'GPT-4o',
    agentProviderName: null,
    messageCount: 6,
    artifacts: [
      { id: '123e4567-e89b-12d3-a456-426614174000', label: 'Sample Artifact', fileExtension: '.txt' },
    ],
  },
];

describe('getChatMetadata procedure', () => {
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getChatMetadata as jest.Mock).mockResolvedValue(mockMetadata);

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      logger: logger,
    } as unknown as ContextType;
  });

  it('returns metadata for the requested chat ids scoped to the current user', async () => {
    const input = { chatIds: [mockChatId] };
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.getChatMetadata(input);

    expect(result).toEqual({ metadata: mockMetadata });
    expect(getChatMetadata).toHaveBeenCalledWith(mockUserId, [mockChatId]);
  });
});
