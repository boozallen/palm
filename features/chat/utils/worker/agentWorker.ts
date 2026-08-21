import { Worker } from 'bullmq';
import { v4 } from 'uuid';
import { storage } from '@/server/storage/redis';
import logger from '@/server/logger';
import { AgentChatJobData } from './agentQueue';
import { getRedisClient } from '@/server/storage/redisConnection';
import { DEFAULT_WORKER_CONFIG } from '@/features/ai-agents/utils/shared/types';
import { AsyncChatStatus } from '@/features/chat/types/message';
import { AgentApiClient } from '@/features/agent-provider/sources/api-client';
import { AuditedSource } from '@/features/ai-provider/sources/audit';
import {
  extractArtifactsFromMessage,
  addChatMessageIdToArtifacts,
  formatArtifactLabel,
} from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import { extractFollowUpQuestionsFromMessage } from '@/features/chat/utils/followUpQuestionsHelpers';
import getMessages from '@/features/chat/dal/getMessages';
import getChat from '@/features/chat/dal/getChat';
import ensureAgentSession from '@/features/chat/utils/ensureAgentSession';
import clearChatAgentSession from '@/features/chat/dal/clearChatAgentSession';
import getAgentProvider from '@/features/settings/dal/agent-providers/getAgentProvider';
import getAvailableGitHubProviders from '@/features/shared/dal/getAvailableGitHubProviders';
import { GitHubFactory } from '@/features/github-provider/factory';
import db from '@/server/db';
import { BINARY_FILE_EXTENSIONS } from '@/features/shared/types/document';
import { enqueueConversationGraphSync } from '@/features/graph-database/utils/worker/conversationGraphQueue';
import { isMemoryEnabled } from '@/features/graph-database/utils/isMemoryEnabled';

let worker: Worker | null = null;

export const startAgentChatWorker = async (): Promise<void> => {
  if (worker) {
    throw new Error('Worker is already running');
  }

  const connection = getRedisClient();

  worker = new Worker<AgentChatJobData>(
    'agent-chat-jobs',
    async (job) => {
      const { jobId, chatId, messageId, userMessage, sessionId: initialSessionId, agentProviderId, userId } = job.data;

      try {
        logger.info(`[AgentWorker] Job ${jobId} started`);
        await storage.hset(`chat-job:${jobId}`, {
          status: 'processing',
          progress: 'Contacting agent...',
          created: Date.now(),
        });

        // Fetch agent config from DB
        const agentProviderRecord = await getAgentProvider(agentProviderId);
        const agent = new AuditedSource(
          new AgentApiClient({
            endpoint: agentProviderRecord.endpoint,
            apiKey: agentProviderRecord.apiKey ?? undefined,
          }),
          userId,
          db,
        );

        // Fetch full conversation history from DB
        // Filter out pending async messages (the placeholder created for the current job)
        const dbMessages = await getMessages(chatId);
        const chatMessages = dbMessages
          .filter((msg) => msg.asyncChatStatus !== AsyncChatStatus.PROCESSING)
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

        let sessionId = initialSessionId;
        let assistantMessage;

        try {
          assistantMessage = await agent.chatCompletion(chatMessages, {
            model: '',
            temperature: 0.2,
            topP: 0.5,
            sessionId,
          });
        } catch (err) {
          if (err instanceof Error && err.message === 'AGENT_SESSION_NOT_FOUND') {
            logger.info('[AgentWorker] Session expired - recreating');
            await clearChatAgentSession(chatId);
            const chat = await getChat(chatId);
            sessionId = await ensureAgentSession(
              { ...chat, externalSessionId: null },
              userMessage,
              agentProviderRecord.endpoint,
              agentProviderRecord.apiKey ?? undefined,
            );
            assistantMessage = await agent.chatCompletion(chatMessages, {
              model: '',
              temperature: 0.2,
              topP: 0.5,
              sessionId,
            });
          } else {
            throw err;
          }
        }

        console.log(' - - ');
        console.log(' ');
        console.log(assistantMessage);

        // Process artifacts from model response
        const { artifacts, cleanedText } = extractArtifactsFromMessage(assistantMessage.text);

        // Process artifacts from agent-provider ('sales-as-code' agent) response by 
        // pulling data from Github based on URL
        const githubArtifactPropertyKeys = [
          'prd_path', 
          'outline_path', 
          'prd_word_path',
          'video_path', 
          'presentation_html_url', 
          'narrated_html_url',
          'script_path',
        ];
        const githubArtifacts = assistantMessage.artifacts || {};
        const githubArtifactsList = Object.entries(githubArtifacts)
          .filter(([key, url]) =>
            githubArtifactPropertyKeys.includes(key) &&
            typeof url === 'string' &&
            url.trim().length > 0
          )
          .flatMap(([key, url]) => {
            const filename = url.split('/').pop();
            if (!filename) {
              return [];
            }

            const parts = filename.split('.');
            const fileExtension = parts.length > 1 ? `.${parts[parts.length - 1]}` : null;

            if (!fileExtension) {
              return [];
            }

            const label = formatArtifactLabel(filename);

            return [{
              id: v4(),
              chatMessageId: messageId,
              label,
              content: '',
              fileExtension,
              githubUrl: url,
              githubPagesUrl: null,
              createdAt: new Date(),
            }];
          });

        const fetchedGithubArtifacts: typeof githubArtifactsList = [];

        if (githubArtifactsList.length > 0) {
          const providers = await getAvailableGitHubProviders(userId);
          if (providers.length > 0) {
            const provider = providers[0];
            const factory = new GitHubFactory({ userId });
            const { source } = await factory.buildSource(provider.id);

            for (const artifact of githubArtifactsList) {
              try {
                // Agent returns html_url format: {baseUrl}/{owner}/{repo}/blob/{branch}/{path}
                // Strip base URL prefix then parse owner/repo/branch/path
                const baseUrl = `${new URL(provider.apiBaseUrl).protocol}//${new URL(provider.apiBaseUrl).hostname}`;
                const urlPath = artifact.githubUrl!.replace(baseUrl, '').replace(/^\//, '');
                const [owner, repo, , branch, ...rest] = urlPath.split('/');
                const filePath = rest.join('/');

                // Binary files are fetched as Buffer and stored in binaryContent field
                if (BINARY_FILE_EXTENSIONS.includes(artifact.fileExtension.toLowerCase())) {
                  const result = await source.getBinaryFile({ owner, repo, filePath, branch });
                  (artifact as typeof artifact & { binaryContent: Buffer }).binaryContent = result.content;
                  logger.info(`[AgentWorker] Fetched binary content for: ${artifact.label} (${artifact.fileExtension})`);
                } else {
                  // Text files are stored in content field as string
                  const result = await source.getFile({ owner, repo, filePath, branch });
                  artifact.content = result.content;
                }

                // Only add if fetch succeeded
                fetchedGithubArtifacts.push(artifact);
              } catch (err) {
                logger.warn(`[AgentWorker] Failed to fetch GitHub content for artifact "${artifact.label}": ${err instanceof Error ? err.message : err}. Artifact will not be created.`);
              }
            }
          } else {
            logger.warn('[AgentWorker] No GitHub providers available to fetch artifact content');
          }
        }

        // Process user_choices from agent response
        const userChoicesData = assistantMessage.userChoices || {};

        const userChoicesList = Object.entries(userChoicesData)
          .filter(([, value]) => typeof value === 'string' && (value as string).trim().length > 0)
          .map(([label, value]) => ({
            chatMessageId: messageId,
            label: label.replace(/_/g, ' '),
            value: value as string,
          }));

        const { followUpQuestions, cleanedText: finalText } = extractFollowUpQuestionsFromMessage(cleanedText);

        addChatMessageIdToArtifacts(artifacts, messageId);

        const allArtifacts = [...artifacts, ...fetchedGithubArtifacts];

        const finalProgressMessages = await storage.lrange(`chat-job-progress:${jobId}`, 0, -1);

        await db.$transaction(async (prisma) => {
          await prisma.chatMessage.update({
            where: { id: messageId },
            data: {
              content: finalText,
              asyncChatStatus: AsyncChatStatus.COMPLETED,
              ...(finalProgressMessages.length > 0 && { progressMessages: finalProgressMessages }),
            },
          });

          if (allArtifacts.length > 0) {
            // Cannot use createMany with bytea fields, must create individually
            for (const a of allArtifacts) {
              await prisma.chatArtifact.create({
                data: {
                  id: a.id,
                  fileExtension: a.fileExtension,
                  label: a.label,
                  content: a.content,
                  binaryContent: (a as typeof a & { binaryContent?: Buffer }).binaryContent || null,
                  chatMessageId: messageId,
                  githubPagesUrl: a.githubPagesUrl || null,
                  githubUrl: a.githubUrl || null,
                  createdAt: a.createdAt,
                },
              });
            }
          }

          if (followUpQuestions.length > 0) {
            await prisma.chatMessageFollowUp.createMany({
              data: followUpQuestions.map((q) => ({
                content: q,
                chatMessageId: messageId,
              })),
            });
          }

          if (userChoicesList.length > 0) {
            await prisma.chatMessageUserChoice.createMany({
              data: userChoicesList,
            });
          }
        });

        if (await isMemoryEnabled()) {
          void enqueueConversationGraphSync({
            chatId,
            messageIds: [messageId],
          });
        }

        await storage.hset(`chat-job:${jobId}`, {
          status: 'completed',
          completed: Date.now(),
        });

        logger.info(`[AgentWorker] Job ${jobId} completed successfully`);
        return { success: true };
      } catch (error) {
        logger.error(`[AgentWorker] Job ${jobId} failed:`, error);

        await db.chatMessage.update({
          where: { id: messageId },
          data: { asyncChatStatus: AsyncChatStatus.ERROR },
        }).catch(() => {});

        await storage.hset(`chat-job:${jobId}`, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          completed: Date.now(),
        });

        throw error;
      }
    },
    {
      connection,
      lockDuration: DEFAULT_WORKER_CONFIG.lockDuration,
      concurrency: DEFAULT_WORKER_CONFIG.concurrency,
      limiter: DEFAULT_WORKER_CONFIG.limiter,
      stalledInterval: DEFAULT_WORKER_CONFIG.stalledInterval,
      maxStalledCount: DEFAULT_WORKER_CONFIG.maxStalledCount,
    },
  );

  worker.on('completed', (job) => {
    logger.info(`[AgentWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[AgentWorker] Job ${job?.id} failed`, err);
  });

  process.on('SIGTERM', async () => {
    await worker?.close();
  });

  logger.info('[AgentWorker] Started');
};
