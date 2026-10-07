import { router } from '@/server/trpc';
import deleteMessage from './delete-message';
import getUserChat from './get-chat';
import getMessages from './get-messages';
import getOriginPrompt from './get-origin-prompt';
import createChat from './create-chat';
import addMessage from './add-message';
import getChats from './get-chats';
import getChatMetadata from './get-chat-metadata';
import deleteChat from './delete-chat';
import retryMessage from './retry-message';
import updateChatConversationSummary from './update-chat-conversation-summary';
import updateMessage from './update-message';
import rateMessage from './rate-message';
import deleteMessageFeedback from './delete-message-feedback';
import getDeepResearchStatus from './get-deep-research-status';
import cancelDeepResearch from './cancel-deep-research';
import cancelAgenticChat from './cancel-agentic-chat';
import { getChatJobStatus } from './get-chat-job-status';
import graphDatabase from './graph-database';
import getSnapshotGraph from './get-snapshot-graph';
import pushArtifactToGithub from './push-artifact-to-github';
import getCitedArtifact from './get-cited-artifact';
import saveArtifactVersion from './save-artifact-version';
import getArtifactVersions from './get-artifact-versions';

export default router({
  deleteMessage,
  createChat,
  addMessage,
  getUserChat,
  getMessages,
  getOriginPrompt,
  getChats,
  getChatMetadata,
  deleteChat,
  retryMessage,
  updateChatConversationSummary,
  updateMessage,
  rateMessage,
  deleteMessageFeedback,
  getDeepResearchStatus,
  cancelDeepResearch,
  cancelAgenticChat,
  getChatJobStatus,
  graphDatabase,
  getSnapshotGraph,
  pushArtifactToGithub,
  getCitedArtifact,
  saveArtifactVersion,
  getArtifactVersions,
});
