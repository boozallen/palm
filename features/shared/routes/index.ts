import { router } from '@/server/trpc';
import getFeatureFlag from './get-feature-flag';
import getAvailableModels from './get-available-models';
import getSystemConfig from './get-system-config';
import getUserKnowledgeBases from './get-user-knowledge-bases';
import getUserPreselectedKnowledgeBases from './get-user-preselected-knowledge-bases';
import getIsUserGroupLead from './get-is-user-group-lead';
import runPrompt from './run-prompt';
import getTags from './get-tags';
import createPrompt from './create-prompt';
import getPromptTagSuggestions from './get-prompt-tag-suggestions';
import getUserAdvancedKbSettings from './get-user-advanced-kb-settings';
import getAvailableAgents from './get-available-agents';
import getUserEnabledAiAgents from './get-user-enabled-ai-agents';
import getDocuments from './document-library/upload/get-documents';
import getDocumentContent from './document-library/upload/get-document-content';
import deleteDocument from './document-library/upload/delete-document';
import getPresignedUrl from './document-library/upload/get-presigned-url';
import processDocument from './document-library/upload/process-document';
import getDocumentUploadRequirements from './document-library/upload/get-document-upload-requirements';
import getBedrockModelAccess from './get-bedrock-model-access';
import getUserGraphDatabaseAccess from './get-user-graph-database-access';
import getDocumentLibraryDataSharingEnabled from './document-library/upload/get-document-library-data-sharing-enabled';
import shareDocument from './document-library/upload/share-document';
import updateDocumentShares from './document-library/upload/update-document-shares';
import getSharedDocuments from './document-library/upload/get-shared-documents';
import rejectSharedDocument from './document-library/upload/reject-shared-document';
import acceptSharedDocument from './document-library/upload/accept-shared-document';
import getGraphCopyStatus from './document-library/upload/get-graph-copy-status';
import getUserWorkflowsAccess from './get-user-workflows-access';
import getAvailableAgentProviders from './get-available-agent-providers';
import getAvailableGitHubProviders from './get-available-github-providers';
import getUserContextStudioAccess from './get-user-context-studio-access';
import { documentCollectionsRouter } from './document-library/collections';
import getUserAgenticChatAccess from './get-user-agentic-chat-access';
import acknowledgeSecurityPolicy from './acknowledge-security-policy';
import getWorkspaceStats from './get-workspace-stats';
import createClientSideAuditRecord from './create-client-side-audit-record';

export default router({
  createPrompt,
  getFeatureFlag,
  getAvailableModels,
  getSystemConfig,
  getUserKnowledgeBases,
  getUserPreselectedKnowledgeBases,
  getTags,
  runPrompt,
  getPromptTagSuggestions,
  getUserAdvancedKbSettings,
  getAvailableAgents,
  getUserEnabledAiAgents,
  getDocuments,
  getDocumentContent,
  deleteDocument,
  getIsUserGroupLead,
  getPresignedUrl,
  processDocument,
  getDocumentUploadRequirements,
  getBedrockModelAccess,
  getUserGraphDatabaseAccess,
  getDocumentLibraryDataSharingEnabled,
  shareDocument,
  updateDocumentShares,
  getSharedDocuments,
  rejectSharedDocument,
  acceptSharedDocument,
  getGraphCopyStatus,
  getUserWorkflowsAccess,
  getAvailableAgentProviders,
  getAvailableGitHubProviders,
  getUserContextStudioAccess,
  documentCollections: documentCollectionsRouter,
  getUserAgenticChatAccess,
  acknowledgeSecurityPolicy,
  getWorkspaceStats,
  createClientSideAuditRecord,
});
