import { Artifact } from '@/features/chat/types/message';
import {
  AuditRecordMetadata,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';

// Builders that assemble audit metadata for the resources users copy and
// download. Centralized so every call site records the same shape.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Client-side ids are sometimes placeholders ('pending', 'retry-<id>'). The
// server rejects a non-uuid resource id, taking the whole record with it, so
// drop the id instead — less context still beats no record.
function asUuid(value: string | null | undefined): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

// ChatArtifact.label is mutable and non-unique, so it is not an identifier —
// pair it with the extension so the record reads like the file the user got.
function artifactFilename(label: string, fileExtension: string): string {
  return `${label}${fileExtension}`;
}

export function buildChatArtifactMetadata(
  artifact: Pick<Artifact, 'id' | 'label' | 'fileExtension'>,
  chatId: string | null,
): AuditRecordMetadata {
  return buildChatArtifactsMetadata([artifact], chatId);
}

// Bulk downloads stay a single audit record, but name every file that left.
export function buildChatArtifactsMetadata(
  artifacts: ReadonlyArray<Pick<Artifact, 'id' | 'label' | 'fileExtension'>>,
  chatId: string | null,
): AuditRecordMetadata {
  const resourceIds = artifacts.map((artifact) => asUuid(artifact.id)).filter((id): id is string => !!id);
  const chat = asUuid(chatId);

  return {
    resourceType: AuditRecordResourceType.ChatArtifact,
    ...(resourceIds.length > 0 ? { resourceIds } : {}),
    filenames: artifacts.map((artifact) => artifactFilename(artifact.label, artifact.fileExtension)),
    ...(chat ? { chatId: chat } : {}),
  };
}

export function buildChatMessageMetadata(
  chatMessageId: string | undefined,
  chatId: string | null,
): AuditRecordMetadata {
  const messageId = asUuid(chatMessageId);
  const chat = asUuid(chatId);

  return {
    resourceType: AuditRecordResourceType.ChatMessage,
    ...(messageId ? { resourceIds: [messageId], chatMessageId: messageId } : {}),
    ...(chat ? { chatId: chat } : {}),
  };
}

export type WorkflowArtifactContext = Readonly<{
  artifactId?: string | null;
  filename?: string | null;
  workflowId?: string | null;
  workflowExecutionId?: string | null;
  primitiveId?: string | null;
}>;

// Renders metadata as one line for the audit records table and its CSV export,
// so a reviewer can see what was touched without querying the JSON.
export function summarizeAuditRecordMetadata(metadata: AuditRecordMetadata | null): string {
  if (!metadata) {
    return '';
  }

  const parts: string[] = [];

  if (metadata.filenames?.length) {
    parts.push(metadata.filenames.join(', '));
  }

  if (metadata.resourceIds?.length) {
    parts.push(`ids: ${metadata.resourceIds.join(', ')}`);
  }

  return parts.length > 0 ? parts.join(' | ') : metadata.resourceType;
}

// A workflow artifact belongs to an execution and a primitive, not just a
// workflow: without those, repeated runs produce indistinguishable records.
export function buildWorkflowArtifactMetadata({
  artifactId,
  filename,
  workflowId,
  workflowExecutionId,
  primitiveId,
}: WorkflowArtifactContext): AuditRecordMetadata {
  const resourceId = asUuid(artifactId);
  const workflow = asUuid(workflowId);
  const execution = asUuid(workflowExecutionId);

  return {
    resourceType: AuditRecordResourceType.WorkflowArtifact,
    ...(resourceId ? { resourceIds: [resourceId] } : {}),
    ...(filename ? { filenames: [filename] } : {}),
    ...(workflow ? { workflowId: workflow } : {}),
    ...(execution ? { workflowExecutionId: execution } : {}),
    ...(primitiveId ? { primitiveId } : {}),
  };
}
