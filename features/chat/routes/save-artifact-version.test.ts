import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import chatRouter from '@/features/chat/routes';
import getMessage from '@/features/chat/dal/getMessage';
import getChat from '@/features/chat/dal/getChat';
import saveChatArtifactVersion from '@/features/chat/dal/saveChatArtifactVersion';

jest.mock('@/features/chat/dal/getMessage');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/saveChatArtifactVersion');

const mockGetMessage = getMessage as jest.MockedFunction<typeof getMessage>;
const mockGetChat = getChat as jest.MockedFunction<typeof getChat>;
const mockSaveChatArtifactVersion = saveChatArtifactVersion as jest.MockedFunction<
  typeof saveChatArtifactVersion
>;

const USER_ID = '10000000-0000-0000-0000-000000000001';
const CHAT_ID = '20000000-0000-0000-0000-000000000002';
const MESSAGE_ID = '30000000-0000-0000-0000-000000000003';
const ARTIFACT_ID = '40000000-0000-0000-0000-000000000004';

const mockArtifact = {
  id: ARTIFACT_ID,
  label: 'My Report',
  fileExtension: '.md',
  content: '# Original',
  chatMessageId: MESSAGE_ID,
  createdAt: new Date(),
};

const baseInput = {
  artifactId: ARTIFACT_ID,
  chatMessageId: MESSAGE_ID,
  content: '# Edited',
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
  mockSaveChatArtifactVersion.mockResolvedValue({ content: '# Edited', versionNumber: 2 });
});

describe('saveArtifactVersion route', () => {
  it('throws when user does not own the chat and is not an admin', async () => {
    ctx.userId = 'other-user-id';
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.saveArtifactVersion(baseInput)).rejects.toThrow(
      'You do not have permission to edit this artifact',
    );
  });

  it('allows an admin to edit an artifact from another user chat', async () => {
    ctx.userId = 'other-user-id';
    ctx.userRole = UserRole.Admin;
    const caller = chatRouter.createCaller(ctx);

    const result = await caller.saveArtifactVersion(baseInput);
    expect(result.versionNumber).toBe(2);
  });

  it('throws when the artifact is not found in the message', async () => {
    mockGetMessage.mockResolvedValueOnce({
      id: MESSAGE_ID,
      chatId: CHAT_ID,
      artifacts: [],
    } as any);
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.saveArtifactVersion(baseInput)).rejects.toThrow('Artifact not found');
  });

  it('throws when the artifact is a binary type', async () => {
    mockGetMessage.mockResolvedValueOnce({
      id: MESSAGE_ID,
      chatId: CHAT_ID,
      artifacts: [{ ...mockArtifact, fileExtension: '.docx' }],
    } as any);
    const caller = chatRouter.createCaller(ctx);

    await expect(caller.saveArtifactVersion(baseInput)).rejects.toThrow(
      'This artifact type cannot be edited',
    );
  });

  it('saves a new version and returns the updated content', async () => {
    const caller = chatRouter.createCaller(ctx);
    const result = await caller.saveArtifactVersion(baseInput);

    expect(mockSaveChatArtifactVersion).toHaveBeenCalledWith({
      artifactId: ARTIFACT_ID,
      content: '# Edited',
      editedByUserId: USER_ID,
    });
    expect(result).toEqual({
      artifactId: ARTIFACT_ID,
      content: '# Edited',
      versionNumber: 2,
    });
  });
});
