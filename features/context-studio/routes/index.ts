import { router } from '@/server/trpc';
import getPromptStats from './get-prompt-stats';
import getChatStats from './get-chat-stats';
import getArtifactStats from './get-artifact-stats';
import getWorkflowStats from './get-workflow-stats';
import getDocumentStats from './get-document-stats';
import getKnowledgeBaseStats from './get-knowledge-base-stats';
import getGraphStats from './get-graph-stats';
import getAiAgentStats from './get-ai-agent-stats';
import getAgentProposalJobs from './get-agent-proposal-jobs';
import getUserActivityStats from './get-user-activity-stats';
import getAgentServiceStats from './get-agent-service-stats';
import getConversationToolStats from './get-conversation-tool-stats';
import getPageTransitions from './get-page-transitions';
import getUserActivity from './get-user-activity';
import getUsageRecords from './get-usage-records';
import getUserGroups from './get-user-groups';
import getUserGroupMembers from './get-user-group-members';
import getValueSummary from './get-value-summary';
import getUseCaseDetail from './get-use-case-detail';
import getUseCaseThemes from './get-use-case-themes';
import getChatTranscript from './get-chat-transcript';
import searchChats from './search-chats';
import searchDocuments from './search-documents';
import searchUsers from './search-users';
import searchWorkflowArtifacts from './search-workflow-artifacts';
import searchArtifacts from './search-artifacts';
import getArtifactContent from './get-artifact-content';

export default router({
  getPromptStats,
  getChatStats,
  getArtifactStats,
  getWorkflowStats,
  getDocumentStats,
  getKnowledgeBaseStats,
  getGraphStats,
  getAiAgentStats,
  getAgentProposalJobs,
  getUserActivityStats,
  getAgentServiceStats,
  getConversationToolStats,
  getPageTransitions,
  getUserActivity,
  getUsageRecords,
  getUserGroups,
  getUserGroupMembers,
  getValueSummary,
  getUseCaseDetail,
  getUseCaseThemes,
  getChatTranscript,
  searchChats,
  searchDocuments,
  searchUsers,
  searchWorkflowArtifacts,
  searchArtifacts,
  getArtifactContent,
});
