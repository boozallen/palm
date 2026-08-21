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
  ModifyUserRole = 'MODIFY_USER_ROLE',
  // User Groups
  CreateUserGroup = 'CREATE_USER_GROUP',
  DeleteUserGroup = 'DELETE_USER_GROUP',
  CreateUserGroupMembership = 'CREATE_USER_GROUP_MEMBERSHIP',
  DeleteUserGroupMembership = 'DELETE_USER_GROUP_MEMBERSHIP',
  ModifyUserGroupMembershipRole = 'MODIFY_USER_GROUP_MEMBERSHIP_ROLE',
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
  // Templates
  UploadArtifactTemplate = 'UPLOAD_ARTIFACT_TEMPLATE',
  DeleteArtifactTemplate = 'DELETE_ARTIFACT_TEMPLATE',
  // GitHub
  ConfigureGithubProvider = 'CONFIGURE_GITHUB_PROVIDER',
  PublishArtifactToGithub = 'PUBLISH_ARTIFACT_TO_GITHUB',
  PublishWorkflowArtifactToGithub = 'PUBLISH_WORKFLOW_ARTIFACT_TO_GITHUB',
  // Database (PostgreSQL)
  ExecutePostgresqlQuery = 'EXECUTE_POSTGRESQL_QUERY',
  // Database (Neo4j)
  ExecuteNeo4jQuery = 'EXECUTE_NEO4J_QUERY',
  // Security Policy
  AcknowledgeSecurityPolicy = 'ACKNOWLEDGE_SECURITY_POLICY',
  // UI/UX Interactions
  Navigation = 'NAVIGATION',
  ExternalNavigation = 'EXTERNAL_NAVIGATION',
  // On-screen only. Deliberately not NAVIGATION: no page was left or arrived
  // at, so these must stay out of the page transition matrix and nav counts.
  TogglePanel = 'TOGGLE_PANEL',
  // A text selection inside an assistant response. Only the length of the
  // selection is recorded, never the text: highlighted content is the model
  // output the user is reading, and copying it into the audit trail would put
  // response content in a table that has no business holding it.
  HighlightResponseText = 'HIGHLIGHT_RESPONSE_TEXT',
  CopyContentToClipboard = 'COPY_CONTENT_TO_CLIPBOARD',
  // One event for every artifact download, browser-built or API-served — the
  // code path is an implementation detail. `metadata.resourceType` separates
  // chat artifacts from workflow artifacts.
  DownloadArtifact = 'DOWNLOAD_ARTIFACT',
  // Access
  RequestAccessToPalm = 'REQUEST_ACCESS_TO_PALM',
}

export const AuditRecordEventLabels: Record<AuditRecordEvent, string> = {
  [AuditRecordEvent.ModifyAccount]: 'Modify Account',
  [AuditRecordEvent.CreateUser]: 'Create User',
  [AuditRecordEvent.UserSignIn]: 'User Sign In',
  [AuditRecordEvent.UserSignOut]: 'User Sign Out',
  [AuditRecordEvent.ModifyUserRole]: 'Modify User Role',
  [AuditRecordEvent.CreateUserGroup]: 'Create User Group',
  [AuditRecordEvent.DeleteUserGroup]: 'Delete User Group',
  [AuditRecordEvent.CreateUserGroupMembership]: 'Create User Group Membership',
  [AuditRecordEvent.DeleteUserGroupMembership]: 'Delete User Group Membership',
  [AuditRecordEvent.ModifyUserGroupMembershipRole]: 'Modify User Group Membership Role',
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
  [AuditRecordEvent.UploadArtifactTemplate]: 'Upload Artifact Template',
  [AuditRecordEvent.DeleteArtifactTemplate]: 'Delete Artifact Template',
  [AuditRecordEvent.ConfigureGithubProvider]: 'Configure GitHub Provider',
  [AuditRecordEvent.PublishArtifactToGithub]: 'Publish Artifact to GitHub',
  [AuditRecordEvent.PublishWorkflowArtifactToGithub]: 'Publish Workflow Artifact to GitHub',
  [AuditRecordEvent.ExecutePostgresqlQuery]: 'Execute PostgreSQL Query',
  [AuditRecordEvent.ExecuteNeo4jQuery]: 'Execute Neo4j Query',
  [AuditRecordEvent.AcknowledgeSecurityPolicy]: 'Acknowledge Security Policy',
  [AuditRecordEvent.Navigation]: 'Navigation',
  [AuditRecordEvent.ExternalNavigation]: 'External Navigation',
  [AuditRecordEvent.TogglePanel]: 'Toggle Panel',
  [AuditRecordEvent.HighlightResponseText]: 'Highlight Response Text',
  [AuditRecordEvent.CopyContentToClipboard]: 'Copy Content to Clipboard',
  [AuditRecordEvent.DownloadArtifact]: 'Download Artifact',
  [AuditRecordEvent.RequestAccessToPalm]: 'Request Access to PALM',
};

// The kind of resource an audited action was performed on. Recorded alongside
// the resource ids so a reviewer knows which table to look in.
export enum AuditRecordResourceType {
  ChatArtifact = 'CHAT_ARTIFACT',
  ChatMessage = 'CHAT_MESSAGE',
  WorkflowArtifact = 'WORKFLOW_ARTIFACT',
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
  // The href is the externally configured access-request destination, recorded
  // alongside the label rather than as an in-app navigation.
  [AuditRecordEvent.RequestAccessToPalm]: ({ label, href }) =>
    `User requested access to PALM via "${label}"${href ? ` (${href})` : ''}`,
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
