import { z } from 'zod';

import { AuditorDetails, AuditorOptions } from '@/server/auditor';

export enum AuditRecordOutcome {
  Success = 'SUCCESS',
  Error = 'ERROR',
  Warn = 'WARN',
  Info = 'INFO',
}

export const AuditRecordOutcomeLabels: Record<AuditRecordOutcome, string> = {
  [AuditRecordOutcome.Success]: 'Success',
  [AuditRecordOutcome.Error]: 'Error',
  [AuditRecordOutcome.Warn]: 'Warning',
  [AuditRecordOutcome.Info]: 'Info',
};

export enum AuditRecordEvent {
  // Account
  ModifyAccount = 'MODIFY_ACCOUNT',
  // User
  CreateUser = 'CREATE_USER',
  UserSignIn = 'USER_SIGN_IN',
  UserSignOut = 'USER_SIGN_OUT',
  // Written by the session-expiry reconciler for sessions the client never explicitly signed out of (tab closed, crash, sleep).
  UserSessionExpired = 'USER_SESSION_EXPIRED',
  ModifyUserRole = 'MODIFY_USER_ROLE',
  // User Groups
  CreateUserGroup = 'CREATE_USER_GROUP',
  DeleteUserGroup = 'DELETE_USER_GROUP',
  CreateUserGroupMembership = 'CREATE_USER_GROUP_MEMBERSHIP',
  DeleteUserGroupMembership = 'DELETE_USER_GROUP_MEMBERSHIP',
  ModifyUserGroupMembershipRole = 'MODIFY_USER_GROUP_MEMBERSHIP_ROLE',
  // User Group resource access — what a group can reach, distinct from membership/role.
  ModifyUserGroupAiProviderAccess = 'MODIFY_USER_GROUP_AI_PROVIDER_ACCESS',
  ModifyUserGroupAgentProviderAccess = 'MODIFY_USER_GROUP_AGENT_PROVIDER_ACCESS',
  ModifyUserGroupAiAgentAccess = 'MODIFY_USER_GROUP_AI_AGENT_ACCESS',
  ModifyUserGroupKbProviderAccess = 'MODIFY_USER_GROUP_KB_PROVIDER_ACCESS',
  ModifyUserGroupGithubProviderAccess = 'MODIFY_USER_GROUP_GITHUB_PROVIDER_ACCESS',
  ModifyUserGroupArtifactTemplateAccess = 'MODIFY_USER_GROUP_ARTIFACT_TEMPLATE_ACCESS',
  ModifyUserGroupWorkflowsAccess = 'MODIFY_USER_GROUP_WORKFLOWS_ACCESS',
  ModifyUserGroupGraphDatabaseAccess = 'MODIFY_USER_GROUP_GRAPH_DATABASE_ACCESS',
  ModifyUserGroupContextStudioAccess = 'MODIFY_USER_GROUP_CONTEXT_STUDIO_ACCESS',
  ModifyUserGroupAgenticChatAccess = 'MODIFY_USER_GROUP_AGENTIC_CHAT_ACCESS',
  ModifyUserGroupMonthlyBudget = 'MODIFY_USER_GROUP_MONTHLY_BUDGET',
  // Authentication
  ModifyAzureAdScopes = 'MODIFY_AZURE_AD_SCOPES',
  // Chat
  DeleteChat = 'DELETE_CHAT',
  DeleteMessage = 'DELETE_MESSAGE',
  EditMessage = 'EDIT_MESSAGE',
  RateMessage = 'RATE_MESSAGE',
  // The user opened the feedback modal by clicking a thumbs up/down button.
  OpenMessageFeedbackModal = 'OPEN_MESSAGE_FEEDBACK_MODAL',
  // The feedback modal was closed without submitting a rating.
  CancelMessageFeedbackModal = 'CANCEL_MESSAGE_FEEDBACK_MODAL',
  // The user cleared an existing rating by clicking the already-active thumb.
  DeleteMessageFeedback = 'DELETE_MESSAGE_FEEDBACK',
  // Templates
  UploadArtifactTemplate = 'UPLOAD_ARTIFACT_TEMPLATE',
  DeleteArtifactTemplate = 'DELETE_ARTIFACT_TEMPLATE',
  // Document Library
  ToggleDocumentLibraryDataSharing = 'TOGGLE_DOCUMENT_LIBRARY_DATA_SHARING',
  ShareDocumentLibraryData = 'SHARE_DOCUMENT_LIBRARY_DATA',
  ReshareDocumentLibraryData = 'RESHARE_DOCUMENT_LIBRARY_DATA',
  UpdateDocumentShares = 'UPDATE_DOCUMENT_SHARES',
  AcceptDocumentLibraryDataShare = 'ACCEPT_DOCUMENT_LIBRARY_DATA_SHARE',
  RejectDocumentLibraryDataShare = 'REJECT_DOCUMENT_LIBRARY_DATA_SHARE',
  PromoteDocumentToAdminDataSource = 'PROMOTE_DOCUMENT_TO_ADMIN_DATA_SOURCE',
  DemoteDocumentFromAdminDataSource = 'DEMOTE_DOCUMENT_FROM_ADMIN_DATA_SOURCE',
  PromoteDocumentCollectionToAdminDataSource = 'PROMOTE_DOCUMENT_COLLECTION_TO_ADMIN_DATA_SOURCE',
  DemoteDocumentCollectionFromAdminDataSource = 'DEMOTE_DOCUMENT_COLLECTION_FROM_ADMIN_DATA_SOURCE',
  // Workflows
  ShareWorkflow = 'SHARE_WORKFLOW',
  ReshareWorkflow = 'RESHARE_WORKFLOW',
  UpdateWorkflowShares = 'UPDATE_WORKFLOW_SHARES',
  AcceptWorkflowShare = 'ACCEPT_WORKFLOW_SHARE',
  RejectWorkflowShare = 'REJECT_WORKFLOW_SHARE',
  WorkflowExecutionFormSubmission = 'WORKFLOW_EXECUTION_FORM_SUBMISSION',
  // AI/KB/Agent Providers — the connection/config itself, distinct from which
  // user group can access it (see ModifyUserGroup*ProviderAccess above).
  ConfigureAiProvider = 'CONFIGURE_AI_PROVIDER',
  DeleteAiProvider = 'DELETE_AI_PROVIDER',
  ConfigureKbProvider = 'CONFIGURE_KB_PROVIDER',
  DeleteKbProvider = 'DELETE_KB_PROVIDER',
  ConfigureAgentProvider = 'CONFIGURE_AGENT_PROVIDER',
  DeleteAgentProvider = 'DELETE_AGENT_PROVIDER',
  // GitHub
  ConfigureGithubProvider = 'CONFIGURE_GITHUB_PROVIDER',
  DeleteGithubProvider = 'DELETE_GITHUB_PROVIDER',
  PublishArtifactToGithub = 'PUBLISH_ARTIFACT_TO_GITHUB',
  PublishWorkflowArtifactToGithub = 'PUBLISH_WORKFLOW_ARTIFACT_TO_GITHUB',
  // Database
  ExecutePostgresqlQuery = 'EXECUTE_POSTGRESQL_QUERY',
  ExecuteNeo4jQuery = 'EXECUTE_NEO4J_QUERY',
  // Security Policy
  AcknowledgeSecurityPolicy = 'ACKNOWLEDGE_SECURITY_POLICY',
  // Standalone AI agent job submissions, distinct from agent-provider-backed
  // chats (which audit via SubmitChatMessage/RetryChatMessage).
  AiAgentOdramFormSubmission = 'AI_AGENT_ODRAM_FORM_SUBMISSION',
  AiAgentPrismFormSubmission = 'AI_AGENT_PRISM_FORM_SUBMISSION',
  AiAgentRadarFormSubmission = 'AI_AGENT_RADAR_FORM_SUBMISSION',
  AiAgentSwearFormSubmission = 'AI_AGENT_SWEAR_FORM_SUBMISSION',
  AiAgentCertaFormSubmission = 'AI_AGENT_CERTA_FORM_SUBMISSION',
  // Chat
  ChatMessageFormSubmission = 'CHAT_MESSAGE_FORM_SUBMISSION',
  ChatMessageRetry = 'CHAT_MESSAGE_RETRY',
  // UI/UX Interactions
  Navigation = 'NAVIGATION',
  ExternalNavigation = 'EXTERNAL_NAVIGATION',
  // Not NAVIGATION: no page was left or arrived at, toggles visibility.
  TogglePanel = 'TOGGLE_PANEL',
  // Records selection length only, never the highlighted text itself.
  HighlightResponseText = 'HIGHLIGHT_RESPONSE_TEXT',
  CopyContentToClipboard = 'COPY_CONTENT_TO_CLIPBOARD',
  DownloadArtifact = 'DOWNLOAD_ARTIFACT',
  // The user opened the inline editor for an artifact.
  EditArtifact = 'EDIT_ARTIFACT',
  // The user backed out of the inline editor without saving.
  CancelEditArtifact = 'CANCEL_EDIT_ARTIFACT',
  // Stepping between an artifact's saved versions with the prev/next arrows.
  NavigateArtifactVersion = 'NAVIGATE_ARTIFACT_VERSION',
  // A new version was created, either from an inline edit or a restore.
  SaveArtifactVersion = 'SAVE_ARTIFACT_VERSION',
  RestoreArtifactVersion = 'RESTORE_ARTIFACT_VERSION',
  // Switching an artifact's pane between the rendered preview and raw code/text.
  ToggleArtifactViewMode = 'TOGGLE_ARTIFACT_VIEW_MODE',
  // Idle session flow: warning modal, then "Continue session" on it.
  DisplayIdleWarningModal = 'DISPLAY_IDLE_WARNING_MODAL',
  ExtendSession = 'EXTEND_SESSION',
  // User group attribution sidebar control modal.
  UserGroupAttributionModalToggle = 'USER_GROUP_ATTRIBUTION_MODAL_TOGGLE',
  UserGroupAttributionModalSelectGroup = 'USER_GROUP_ATTRIBUTION_MODAL_SELECT_GROUP',
  UserGroupAttributionModalClose = 'USER_GROUP_ATTRIBUTION_MODAL_CLOSE',
  // Access
  RequestAccessToPalm = 'REQUEST_ACCESS_TO_PALM',
}

export const AuditRecordEventLabels: Record<AuditRecordEvent, string> = {
  [AuditRecordEvent.ModifyAccount]: 'Modify Account',
  [AuditRecordEvent.CreateUser]: 'Create User',
  [AuditRecordEvent.UserSignIn]: 'User Sign In',
  [AuditRecordEvent.UserSignOut]: 'User Sign Out',
  [AuditRecordEvent.UserSessionExpired]: 'User Session Expired',
  [AuditRecordEvent.ModifyUserRole]: 'Modify User Role',
  [AuditRecordEvent.CreateUserGroup]: 'Create User Group',
  [AuditRecordEvent.DeleteUserGroup]: 'Delete User Group',
  [AuditRecordEvent.CreateUserGroupMembership]: 'Create User Group Membership',
  [AuditRecordEvent.DeleteUserGroupMembership]: 'Delete User Group Membership',
  [AuditRecordEvent.ModifyUserGroupMembershipRole]: 'Modify User Group Membership Role',
  [AuditRecordEvent.ModifyUserGroupAiProviderAccess]: 'Modify User Group AI Provider Access',
  [AuditRecordEvent.ModifyUserGroupAgentProviderAccess]: 'Modify User Group Agent Provider Access',
  [AuditRecordEvent.ModifyUserGroupAiAgentAccess]: 'Modify User Group AI Agent Access',
  [AuditRecordEvent.ModifyUserGroupKbProviderAccess]: 'Modify User Group Knowledge Base Provider Access',
  [AuditRecordEvent.ModifyUserGroupGithubProviderAccess]: 'Modify User Group GitHub Provider Access',
  [AuditRecordEvent.ModifyUserGroupArtifactTemplateAccess]: 'Modify User Group Artifact Template Access',
  [AuditRecordEvent.ModifyUserGroupWorkflowsAccess]: 'Modify User Group Workflows Access',
  [AuditRecordEvent.ModifyUserGroupGraphDatabaseAccess]: 'Modify User Group Graph Database Access',
  [AuditRecordEvent.ModifyUserGroupContextStudioAccess]: 'Modify User Group Context Studio Access',
  [AuditRecordEvent.ModifyUserGroupAgenticChatAccess]: 'Modify User Group Agentic Chat Access',
  [AuditRecordEvent.ModifyUserGroupMonthlyBudget]: 'Modify User Group Monthly Budget',
  [AuditRecordEvent.ModifyAzureAdScopes]: 'Modify Azure AD Scopes',
  [AuditRecordEvent.DeleteChat]: 'Delete Chat',
  [AuditRecordEvent.DeleteMessage]: 'Delete Message',
  [AuditRecordEvent.EditMessage]: 'Edit Message',
  [AuditRecordEvent.RateMessage]: 'Rate Message',
  [AuditRecordEvent.OpenMessageFeedbackModal]: 'Open Message Feedback Modal',
  [AuditRecordEvent.CancelMessageFeedbackModal]: 'Cancel Message Feedback Modal',
  [AuditRecordEvent.DeleteMessageFeedback]: 'Delete Message Feedback',
  [AuditRecordEvent.ToggleDocumentLibraryDataSharing]: 'Toggle Document Library Data Sharing',
  [AuditRecordEvent.ShareDocumentLibraryData]: 'Share Document Library Data',
  [AuditRecordEvent.ReshareDocumentLibraryData]: 'Reshare Document Library Data',
  [AuditRecordEvent.UpdateDocumentShares]: 'Update Document Shares',
  [AuditRecordEvent.AcceptDocumentLibraryDataShare]: 'Accept Document Library Data Share',
  [AuditRecordEvent.RejectDocumentLibraryDataShare]: 'Reject Document Library Data Share',
  [AuditRecordEvent.PromoteDocumentToAdminDataSource]: 'Promote Document to Admin Data Source',
  [AuditRecordEvent.DemoteDocumentFromAdminDataSource]: 'Demote Document from Admin Data Source',
  [AuditRecordEvent.PromoteDocumentCollectionToAdminDataSource]: 'Promote Document Collection to Admin Data Source',
  [AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource]: 'Demote Document Collection from Admin Data Source',
  [AuditRecordEvent.ShareWorkflow]: 'Share Workflow',
  [AuditRecordEvent.ReshareWorkflow]: 'Reshare Workflow',
  [AuditRecordEvent.UpdateWorkflowShares]: 'Update Workflow Shares',
  [AuditRecordEvent.AcceptWorkflowShare]: 'Accept Workflow Share',
  [AuditRecordEvent.RejectWorkflowShare]: 'Reject Workflow Share',
  [AuditRecordEvent.WorkflowExecutionFormSubmission]: 'Submit Workflow Execution',
  [AuditRecordEvent.UploadArtifactTemplate]: 'Upload Artifact Template',
  [AuditRecordEvent.DeleteArtifactTemplate]: 'Delete Artifact Template',
  [AuditRecordEvent.ConfigureAiProvider]: 'Configure AI Provider',
  [AuditRecordEvent.DeleteAiProvider]: 'Delete AI Provider',
  [AuditRecordEvent.ConfigureKbProvider]: 'Configure Knowledge Base Provider',
  [AuditRecordEvent.DeleteKbProvider]: 'Delete Knowledge Base Provider',
  [AuditRecordEvent.ConfigureAgentProvider]: 'Configure Agent Provider',
  [AuditRecordEvent.DeleteAgentProvider]: 'Delete Agent Provider',
  [AuditRecordEvent.ConfigureGithubProvider]: 'Configure GitHub Provider',
  [AuditRecordEvent.DeleteGithubProvider]: 'Delete GitHub Provider',
  [AuditRecordEvent.PublishArtifactToGithub]: 'Publish Artifact to GitHub',
  [AuditRecordEvent.PublishWorkflowArtifactToGithub]: 'Publish Workflow Artifact to GitHub',
  [AuditRecordEvent.ExecutePostgresqlQuery]: 'Execute PostgreSQL Query',
  [AuditRecordEvent.ExecuteNeo4jQuery]: 'Execute Neo4j Query',
  [AuditRecordEvent.AcknowledgeSecurityPolicy]: 'Acknowledge Security Policy',
  [AuditRecordEvent.AiAgentOdramFormSubmission]: 'Submit ODRAM Analysis',
  [AuditRecordEvent.AiAgentPrismFormSubmission]: 'Submit Proposal Analysis',
  [AuditRecordEvent.AiAgentRadarFormSubmission]: 'Submit Research Job',
  [AuditRecordEvent.AiAgentSwearFormSubmission]: 'Submit Warrant Analysis',
  [AuditRecordEvent.AiAgentCertaFormSubmission]: 'Submit Policy Compliance Check',
  [AuditRecordEvent.ChatMessageFormSubmission]: 'Submit Chat Message',
  [AuditRecordEvent.ChatMessageRetry]: 'Retry Chat Message',
  [AuditRecordEvent.Navigation]: 'Navigation',
  [AuditRecordEvent.ExternalNavigation]: 'External Navigation',
  [AuditRecordEvent.TogglePanel]: 'Toggle Panel',
  [AuditRecordEvent.HighlightResponseText]: 'Highlight Response Text',
  [AuditRecordEvent.CopyContentToClipboard]: 'Copy Content to Clipboard',
  [AuditRecordEvent.DownloadArtifact]: 'Download Artifact',
  [AuditRecordEvent.EditArtifact]: 'Edit Artifact',
  [AuditRecordEvent.CancelEditArtifact]: 'Cancel Edit Artifact',
  [AuditRecordEvent.NavigateArtifactVersion]: 'Navigate Artifact Version',
  [AuditRecordEvent.SaveArtifactVersion]: 'Save Artifact Version',
  [AuditRecordEvent.RestoreArtifactVersion]: 'Restore Artifact Version',
  [AuditRecordEvent.ToggleArtifactViewMode]: 'Toggle Artifact View Mode',
  [AuditRecordEvent.DisplayIdleWarningModal]: 'Display Idle Warning Modal',
  [AuditRecordEvent.ExtendSession]: 'Extend Session',
  [AuditRecordEvent.UserGroupAttributionModalToggle]: 'User Group Attribution Modal Toggle',
  [AuditRecordEvent.UserGroupAttributionModalSelectGroup]: 'User Group Attribution Modal Select Group',
  [AuditRecordEvent.UserGroupAttributionModalClose]: 'User Group Attribution Modal Close',
  [AuditRecordEvent.RequestAccessToPalm]: 'Request Access to PALM',
};

// The kind of resource an audited action was performed on. Recorded alongside
// the resource ids so a reviewer knows which table to look in.
export enum AuditRecordResourceType {
  ChatArtifact = 'CHAT_ARTIFACT',
  ChatMessage = 'CHAT_MESSAGE',
  WorkflowArtifact = 'WORKFLOW_ARTIFACT',
  WorkflowExecution = 'WORKFLOW_EXECUTION',
  AiAgentJob = 'AI_AGENT_JOB',
}

// Context stored on an audit record so an action stays correlatable with the
// resource it touched after that resource is gone. Ids are deliberately not
// foreign keys: chat artifacts cascade-delete with their chat.
export const auditRecordMetadata = z.object({
  resourceType: z.nativeEnum(AuditRecordResourceType),
  // An array so bulk actions (download-all) stay one record.
  resourceIds: z.array(z.string().uuid()).max(500).optional(),
  // Denormalized snapshot of where the resource lived.
  chatId: z.string().uuid().optional(),
  chatMessageId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
  workflowExecutionId: z.string().uuid().optional(),
  aiAgentId: z.string().uuid().optional(),
  aiAgentJobId: z.string().uuid().optional(),
  // Not a uuid: primitive ids come from the workflow definition, not the DB.
  primitiveId: z.string().max(200).optional(),
  // Filenames as the user saw them. Mutable and non-unique, so not identifying
  // on their own, but they make a record readable without a join.
  filenames: z.array(z.string().max(500)).max(500).optional(),
});

export type AuditRecordMetadata = z.infer<typeof auditRecordMetadata>;

// Details the client sends for a UI interaction. The server builds the
// description from them so the client can't forge audit copy.
export interface ClientSideAuditRecordDetails {
  label: string;
  href?: string;
}

// The allowlist of events the client may record via
// createClientSideAuditRecord — adding an event means adding a builder here.
// Everything else is audited server-side so the client cannot forge sensitive
// events (sign-ins, policy acknowledgements, permission changes).
export const CLIENT_AUDIT_DESCRIPTION_BUILDERS: Partial<
  Record<AuditRecordEvent, (details: ClientSideAuditRecordDetails) => string>
> = {
  // An `href` marks a navigation; without one it's a non-navigational control.
  [AuditRecordEvent.Navigation]: ({ label, href }) =>
    `User clicked "${href ? `${label} (${href})` : label}"`,
  // Worded unlike Navigation on purpose: an external destination must not parse
  // as an in-app page in the Context Studio behavior views.
  [AuditRecordEvent.ExternalNavigation]: ({ label, href }) =>
    `User opened external link "${label}"${href ? ` (${href})` : ''}`,
  // Avoids the `User clicked "…"` shape the navigation views parse, so a toggle
  // can't read as a visited page even if folded into a nav-family query.
  [AuditRecordEvent.TogglePanel]: ({ label }) => `User toggled ${label}`,
  [AuditRecordEvent.HighlightResponseText]: ({ label }) => `User highlighted ${label}`,
  [AuditRecordEvent.CopyContentToClipboard]: ({ label }) => `User copied ${label}`,
  [AuditRecordEvent.DownloadArtifact]: ({ label }) => `User downloaded ${label}`,
  [AuditRecordEvent.EditArtifact]: ({ label }) => `User started editing ${label}`,
  [AuditRecordEvent.CancelEditArtifact]: ({ label }) => `User cancelled editing ${label}`,
  [AuditRecordEvent.NavigateArtifactVersion]: ({ label }) => `User navigated ${label}`,
  [AuditRecordEvent.SaveArtifactVersion]: ({ label }) => `User saved ${label}`,
  [AuditRecordEvent.RestoreArtifactVersion]: ({ label }) => `User restored ${label}`,
  [AuditRecordEvent.ToggleArtifactViewMode]: ({ label }) => `User switched ${label}`,
  [AuditRecordEvent.OpenMessageFeedbackModal]: ({ label }) => `User opened ${label}`,
  [AuditRecordEvent.CancelMessageFeedbackModal]: ({ label }) => `User closed ${label} without submitting`,
  // Worded like TogglePanel, not Navigation: no page was left or arrived at.
  [AuditRecordEvent.DisplayIdleWarningModal]: ({ label }) => `User was shown the ${label}`,
  [AuditRecordEvent.ExtendSession]: ({ label }) => `User continued their session from the ${label}`,
  // The href is the externally configured access-request destination, recorded
  // alongside the label rather than as an in-app navigation.
  [AuditRecordEvent.RequestAccessToPalm]: ({ label, href }) =>
    `User requested access to PALM via "${label}"${href ? ` (${href})` : ''}`,
  [AuditRecordEvent.UserGroupAttributionModalToggle]: ({ label }) => `User ${label}`,
  [AuditRecordEvent.UserGroupAttributionModalSelectGroup]: ({ label }) => `User ${label}`,
  [AuditRecordEvent.UserGroupAttributionModalClose]: ({ label }) => `User ${label}`,
};

export function buildClientAuditDescription(
  event: AuditRecordEvent,
  details: ClientSideAuditRecordDetails,
): string | null {
  return CLIENT_AUDIT_DESCRIPTION_BUILDERS[event]?.(details) ?? null;
}

export const AuditRecordEventOptions = [
  { value: '', label: 'All Events' },
  ...Object.entries(AuditRecordEventLabels)
    .filter(([key, _]) => isNaN(Number(key)))
    .map(([key, value]) => ({
      value: key,
      label: value,
    })),
];

export const AuditRecordOutcomeOptions = [
  { value: '', label: 'All Outcomes' },
  ...Object.entries(AuditRecordOutcomeLabels)
    .filter(([key, _]) => isNaN(Number(key)))
    .map(([key, value]) => ({
      value: key,
      label: value,
    })),
];

export interface AuditRecord extends AuditorOptions, AuditorDetails { };

export type AuditRecordResult = {
  id: string;
  userName: string | null;
  userEmail: string | null;
  event: AuditRecordEvent;
  outcome: AuditRecordOutcome;
  description: string;
  referer: string | null;
  timestamp: Date;
  metadata: AuditRecordMetadata | null;
};

export type AuditRecordsQueryResult = {
  records: AuditRecordResult[];
  totalCount: number;
};

export const auditRecordsQuery = z.object({
  event: z.string().optional(),
  outcome: z.string().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});

export type AuditRecordsQuery = z.infer<typeof auditRecordsQuery>;

export const auditRecordsInitialValues: AuditRecordsQuery = {
  event: undefined,
  outcome: undefined,
  search: undefined,
  page: 1,
  pageSize: 20,
};
