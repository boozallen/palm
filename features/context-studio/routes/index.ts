import { router } from '@/server/trpc';
import getPromptStats from './get-prompt-stats';
import getChatStats from './get-chat-stats';
import getArtifactStats from './get-artifact-stats';
import getWorkflowStats from './get-workflow-stats';
import getDocumentStats from './get-document-stats';
import getKnowledgeBaseStats from './get-knowledge-base-stats';
import getGraphStats from './get-graph-stats';
import getAiAgentStats from './get-ai-agent-stats';
import getUserActivityStats from './get-user-activity-stats';
import getAgentServiceStats from './get-agent-service-stats';
import getSessionPathStats from './get-session-path-stats';
import getActivityStrips from './get-activity-strips';
import getPageTransitions from './get-page-transitions';
import getUserActivity from './get-user-activity';
import getUsageRecords from './get-usage-records';
import getUserGroups from './get-user-groups';
import getUserGroupMembers from './get-user-group-members';
import searchChats from './search-chats';
import searchDocuments from './search-documents';
import searchUsers from './search-users';
import searchWorkflowArtifacts from './search-workflow-artifacts';

export default router({
  getPromptStats,
  getChatStats,
  getArtifactStats,
  getWorkflowStats,
  getDocumentStats,
  getKnowledgeBaseStats,
  getGraphStats,
  getAiAgentStats,
  getUserActivityStats,
  getAgentServiceStats,
  getSessionPathStats,
  getActivityStrips,
  getPageTransitions,
  getUserActivity,
  getUsageRecords,
  getUserGroups,
  getUserGroupMembers,
  searchChats,
  searchDocuments,
  searchUsers,
  searchWorkflowArtifacts,
});
