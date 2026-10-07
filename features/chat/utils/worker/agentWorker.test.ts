import { startAgentChatWorker } from './agentWorker';
import type { AgentChatJobData } from './agentQueue';
import { AuditedSource } from '@/features/ai-provider/sources/audit';
import assignChatUseCase from '@/features/chat/services/assignChatUseCase';
import clearChatAgentSession from '@/features/chat/dal/clearChatAgentSession';
import ensureAgentSession from '@/features/chat/utils/ensureAgentSession';
import { AsyncChatStatus } from '@/features/chat/types/message';
import { extractArtifactsFromMessage } from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import { enqueueConversationGraphSync } from '@/features/graph-database/utils/worker/conversationGraphQueue';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';
import { storage } from '@/server/storage/redis';
import db from '@/server/db';

const mockWorker = {
  on: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

// Returned by the mocked AuditedSource constructor, so the completion the agent
// would have produced is settable per test.
const mockAgent = {
  chatCompletion: jest.fn(),
};

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => mockWorker),
}));

jest.mock('@/server/storage/redisConnection', () => ({ getRedisClient: jest.fn() }));
jest.mock('@/server/storage/redis', () => ({
  storage: {
    hset: jest.fn().mockResolvedValue(undefined),
    lrange: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('@/features/ai-agents/utils/shared/types', () => ({ DEFAULT_WORKER_CONFIG: {} }));

jest.mock('@/server/logger', () => {
  const l: Record<string, jest.Mock> = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
  };
  l.child.mockReturnValue(l);
  return { __esModule: true, default: l, logger: l };
});

jest.mock('@/server/db', () => {
  const prismaMock: Record<string, unknown> = {
    chatMessage: { update: jest.fn().mockResolvedValue({}) },
    chatArtifact: { create: jest.fn().mockResolvedValue({}) },
    chatMessageFollowUp: { createMany: jest.fn().mockResolvedValue({}) },
    chatMessageUserChoice: { createMany: jest.fn().mockResolvedValue({}) },
  };
  prismaMock.$transaction = jest.fn(async (cb: (p: unknown) => unknown) => cb(prismaMock));
  return { __esModule: true, default: prismaMock };
});

jest.mock('@/features/agent-provider/sources/api-client', () => ({ AgentApiClient: jest.fn() }));
jest.mock('@/features/ai-provider/sources/audit', () => ({
  AuditedSource: jest.fn().mockImplementation(() => mockAgent),
}));

// Pass-through so the reply the agent returned is the text the assertions can follow
// all the way to the database write and the categorization call.
jest.mock('@/features/chat/utils/artifacts/artifactHelperFunctions', () => ({
  extractArtifactsFromMessage: jest.fn((text: string) => ({ artifacts: [], cleanedText: text })),
  addChatMessageIdToArtifacts: jest.fn(),
  formatArtifactLabel: jest.fn((filename: string) => filename),
}));
jest.mock('@/features/chat/utils/followUpQuestionsHelpers', () => ({
  extractFollowUpQuestionsFromMessage: jest.fn((text: string) => ({
    followUpQuestions: [],
    cleanedText: text,
  })),
}));

jest.mock('@/features/chat/dal/getMessages', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/features/chat/dal/getChat', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ id: 'chat-1', externalSessionId: 'session-1' }),
}));
jest.mock('@/features/chat/dal/clearChatAgentSession', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/chat/utils/ensureAgentSession', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue('session-2'),
}));
jest.mock('@/features/settings/dal/agent-providers/getAgentProvider', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ endpoint: 'https://agent.test', apiKey: 'key' }),
}));
jest.mock('@/features/shared/dal/getAvailableGitHubProviders', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/features/github-provider/factory', () => ({ GitHubFactory: jest.fn() }));

// Mocked rather than left to run: the real service reads SystemConfig, which this
// file's db mock does not carry, and it swallows its own failures — so an unmocked one
// would no-op silently and the assertion below would pass for the wrong reason.
jest.mock('@/features/chat/services/assignChatUseCase', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/graph-database/utils/isMemoryEnabled', () => ({
  isMemoryEnabled: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/features/graph-database/utils/worker/conversationGraphQueue', () => ({
  enqueueConversationGraphSync: jest.fn(),
}));

const jobData: AgentChatJobData = {
  jobId: 'job-1',
  userId: 'user-1',
  agentId: 'agent-1',
  chatId: 'chat-1',
  messageId: 'msg-1',
  userMessage: 'Draft the staffing plan for the recompete bid',
  sessionId: 'session-1',
  agentProviderId: 'provider-1',
};

describe('agentWorker', () => {
  let workerCallback: (job: { data: AgentChatJobData }) => Promise<unknown>;

  beforeAll(async () => {
    // The worker is a module-level singleton, so the callback is captured once and the
    // start call is not repeatable — see the guard test below.
    const { Worker } = jest.requireMock<{ Worker: jest.Mock }>('bullmq');
    Worker.mockImplementation(
      (_queueName: string, callback: (job: { data: AgentChatJobData }) => Promise<unknown>) => {
        workerCallback = callback;
        return mockWorker;
      },
    );

    // Silenced, not asserted on: agentWorker logs the raw agent response to stdout,
    // which would bury the rest of the suite's output.
    jest.spyOn(console, 'log').mockImplementation(() => {});

    await startAgentChatWorker();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgent.chatCompletion.mockResolvedValue({ text: 'here is the staffing plan' });
  });

  it('refuses to start a second worker', async () => {
    await expect(startAgentChatWorker()).rejects.toThrow('Worker is already running');
  });

  it('persists the agent reply against the pending message', async () => {
    await workerCallback({ data: jobData });

    expect(db.chatMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: {
        content: 'here is the staffing plan',
        asyncChatStatus: AsyncChatStatus.COMPLETED,
      },
    });
    expect(storage.hset).toHaveBeenCalledWith('chat-job:job-1', {
      status: 'completed',
      completed: expect.any(Number),
    });
  });

  it('stores base64 artifacts as binary and preserves utf-8 artifacts as text', async () => {
    (extractArtifactsFromMessage as jest.Mock).mockReturnValueOnce({
      artifacts: [
        {
          id: 'artifact-base64',
          chatMessageId: '',
          label: 'Binary artifact',
          content: 'YmluYXJ5IHBheWxvYWQ=',
          encoding: 'base64',
          fileExtension: '.pdf',
          githubPagesUrl: null,
          githubUrl: null,
          createdAt: new Date('2026-08-10T12:00:00.000Z'),
        },
        {
          id: 'artifact-text',
          chatMessageId: '',
          label: 'Text artifact',
          content: 'Plain text payload',
          encoding: 'utf-8',
          fileExtension: '.txt',
          githubPagesUrl: null,
          githubUrl: null,
          createdAt: new Date('2026-08-10T12:01:00.000Z'),
        },
      ],
      cleanedText: 'here is the staffing plan',
    });

    await workerCallback({ data: jobData });

    expect(db.chatArtifact.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        id: 'artifact-base64',
        content: '',
        binaryContent: Buffer.from('binary payload'),
      }),
    });
    expect(db.chatArtifact.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        id: 'artifact-text',
        content: 'Plain text payload',
        binaryContent: null,
      }),
    });
  });

  // Categorization happens here rather than in the route that titled the chat, because
  // the route returns before this job has produced a reply to judge. The reply is
  // asserted explicitly: a category derived from the request alone is the defect this
  // exists to prevent, and it would not fail any other assertion.
  it('categorizes the chat from the persisted reply', async () => {
    await workerCallback({ data: jobData });

    expect(assignChatUseCase).toHaveBeenCalledWith({
      chatId: 'chat-1',
      userMessage: jobData.userMessage,
      assistantMessage: 'here is the staffing plan',
    });
  });

  it('does not categorize a chat the agent never answered', async () => {
    mockAgent.chatCompletion.mockRejectedValue(new Error('agent unavailable'));

    await expect(workerCallback({ data: jobData })).rejects.toThrow('agent unavailable');

    expect(assignChatUseCase).not.toHaveBeenCalled();
  });

  it('recreates an expired session and retries the completion', async () => {
    mockAgent.chatCompletion
      .mockRejectedValueOnce(new Error('AGENT_SESSION_NOT_FOUND'))
      .mockResolvedValueOnce({ text: 'here is the staffing plan' });

    await workerCallback({ data: jobData });

    expect(clearChatAgentSession).toHaveBeenCalledWith('chat-1');
    expect(ensureAgentSession).toHaveBeenCalled();
    expect(mockAgent.chatCompletion).toHaveBeenCalledTimes(2);
    expect(mockAgent.chatCompletion).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ sessionId: 'session-2' }),
    );
  });

  it('audits the agent call against the job\'s user', async () => {
    await workerCallback({ data: jobData });

    expect(AuditedSource).toHaveBeenCalledWith(expect.anything(), 'user-1', db);
  });

  it('enqueues the completed message when the memory toggle is on', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(true);

    await workerCallback({ data: jobData });

    expect(enqueueConversationGraphSync).toHaveBeenCalledWith({
      chatId: 'chat-1',
      messageIds: ['msg-1'],
    });
  });

  it('does not enqueue the completed message when the memory toggle is off', async () => {
    (isMemoryEnabled as jest.Mock).mockResolvedValue(false);

    await workerCallback({ data: jobData });

    expect(enqueueConversationGraphSync).not.toHaveBeenCalled();
  });

  it('marks the message errored and rethrows when the agent fails', async () => {
    mockAgent.chatCompletion.mockRejectedValue(new Error('agent unavailable'));

    await expect(workerCallback({ data: jobData })).rejects.toThrow('agent unavailable');

    expect(db.chatMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { asyncChatStatus: AsyncChatStatus.ERROR },
    });
    expect(storage.hset).toHaveBeenCalledWith('chat-job:job-1', {
      status: 'error',
      error: 'agent unavailable',
      completed: expect.any(Number),
    });
  });
});
