import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import chatRouter from '@/features/chat/routes';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import getChatArtifactVersions from '@/features/chat/dal/getChatArtifactVersions';

jest.mock('@/features/chat/dal/getMessage');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/getChatArtifactVersions');

const mockGetMessage = getMessage as jest.MockedFunction<typeof getMessage>;
const mockGetChat = getChat as jest.MockedFunction<typeof getChat>;
const mockGetChatArtifactVersions = getChatArtifactVersions as jest.MockedFunction<
  typeof getChatArtifactVersions
>;

const USER_ID = '10000000-0000-0000-0000-000000000001';
const CHAT_ID = '20000000-0000-0000-0000-000000000002';
const MESSAGE_ID = '30000000-0000-0000-0000-000000000003';
const ARTIFACT_ID = '40000000-0000-0000-0000-000000000004';

const mockArtifact = {
  id: ARTIFACT_ID,
  label: 'My Report',
  fileExtension: '.md',
  content: '# Edited',
  chatMessageId: MESSAGE_ID,
  createdAt: new Date(),
};

const baseInput = {
  artifactId: ARTIFACT_ID,
  chatMessageId: MESSAGE_ID,
};

let ctx: ContextType;

beforeEach(() => {
  jest.clearAllMocks();

  ctx = {
    userId: USER_ID,
    userRole: UserRole.User,
    logger,
    auditor: { createAuditRecord: jest.fn() },
  } as unknown as ContextType;

  mockGetMessage.mockResolvedValue({
    id: MESSAGE_ID,
    chatId: CHAT_ID,
    artifacts: [mockArtifact],
  } as any);
  mockGetChat.mockResolvedValue({
    id: CHAT_ID,
    userId: USER_ID,
  } as any);
  mockGetChatArtifactVersions.mockResolvedValue([
    { id: '50000000-0000-0000-0000-000000000005', versionNumber: 1, content: '# Original', editedByUserId: null, createdAt: new Date() },
    { id: '50000000-0000-0000-0000-000000000006', versionNumber: 2, content: '# Edited', editedByUserId: USER_ID, createdAt: new Date() },
  ]);
});

describe('getArtifactVersions route', () => {
  it('throws when user does not own the chat and is not an admin', async () => {
    ctx.userId = 'other-user-id';
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.getArtifactVersions(baseInput)).rejects.toThrow(
      'You do not have permission to view this artifact version history',
    );
  });

  it('allows an admin to view version history from another user chat', async () => {
    ctx.userId = 'other-user-id';
    ctx.userRole = UserRole.Admin;
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.getArtifactVersions(baseInput);
    expect(result.versions).toHaveLength(2);
  });

  it('throws when the artifact is not found in the message', async () => {
    mockGetMessage.mockResolvedValueOnce({
      id: MESSAGE_ID,
      chatId: CHAT_ID,
      artifacts: [],
    } as any);
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.getArtifactVersions(baseInput)).rejects.toThrow('Artifact not found');
  });

  it('returns the version history for the artifact', async () => {
    const caller = chatRouter.createCaller(ctx);
    const result = await caller.getArtifactVersions(baseInput);

    expect(mockGetChatArtifactVersions).toHaveBeenCalledWith(ARTIFACT_ID);
    expect(result.versions.map((v) => v.versionNumber)).toEqual([1, 2]);
  });
});
