import {
  buildChatArtifactMetadata,
  buildChatArtifactsMetadata,
  buildChatMessageMetadata,
  buildWorkflowArtifactMetadata,
  summarizeAuditRecordMetadata,
} from '@/features/shared/utils/auditRecordMetadata';
import {
  AuditRecordResourceType,
  auditRecordMetadata,
} from '@/features/shared/types/audit-record';
import { Artifact } from '@/features/chat/types/message';

const ARTIFACT_ID = '0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62';
const SECOND_ARTIFACT_ID = '9c1a0d5b-2a54-4e2f-8f1a-91f0a17b6b28';
const CHAT_ID = 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6';
const MESSAGE_ID = 'ce1f6a2f-9f5f-4d4e-8f9a-5d3ba2a35f2b';
const EXECUTION_ID = 'd4c3b8f1-0f6e-4a1b-9c2d-7e8f5a6b3c1d';
const WORKFLOW_ID = 'bb7f2e34-1c2d-4f5a-8b9c-0d1e2f3a4b5c';

const artifact = (overrides: Partial<Artifact> = {}): Artifact => ({
  id: ARTIFACT_ID,
  fileExtension: '.md',
  label: 'Test Artifact',
  content: 'content',
  chatMessageId: MESSAGE_ID,
  githubPagesUrl: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('auditRecordMetadata builders', () => {
  it('builds chat artifact metadata with the id, filename, and chat', () => {
    expect(buildChatArtifactMetadata(artifact(), CHAT_ID)).toEqual({
      resourceType: AuditRecordResourceType.ChatArtifact,
      resourceIds: [ARTIFACT_ID],
      filenames: ['Test Artifact.md'],
      chatId: CHAT_ID,
    });
  });

  it('names every file in a bulk download while staying one record', () => {
    const artifacts = [
      artifact(),
      artifact({ id: SECOND_ARTIFACT_ID, label: 'Report', fileExtension: '.html' }),
    ];

    expect(buildChatArtifactsMetadata(artifacts, CHAT_ID)).toEqual({
      resourceType: AuditRecordResourceType.ChatArtifact,
      resourceIds: [ARTIFACT_ID, SECOND_ARTIFACT_ID],
      filenames: ['Test Artifact.md', 'Report.html'],
      chatId: CHAT_ID,
    });
  });

  it('drops non-uuid ids rather than emitting metadata the server would reject', () => {
    const metadata = buildChatMessageMetadata('pending', null);

    expect(metadata).toEqual({ resourceType: AuditRecordResourceType.ChatMessage });
    expect(auditRecordMetadata.strict().safeParse(metadata).success).toBe(true);
  });

  it('keeps a uuid chat message id', () => {
    expect(buildChatMessageMetadata(MESSAGE_ID, CHAT_ID)).toEqual({
      resourceType: AuditRecordResourceType.ChatMessage,
      resourceIds: [MESSAGE_ID],
      chatMessageId: MESSAGE_ID,
      chatId: CHAT_ID,
    });
  });

  it('records the execution and primitive a workflow artifact came from', () => {
    expect(
      buildWorkflowArtifactMetadata({
        artifactId: ARTIFACT_ID,
        filename: 'output.csv',
        workflowId: WORKFLOW_ID,
        workflowExecutionId: EXECUTION_ID,
        primitiveId: 'generate-report',
      }),
    ).toEqual({
      resourceType: AuditRecordResourceType.WorkflowArtifact,
      resourceIds: [ARTIFACT_ID],
      filenames: ['output.csv'],
      workflowId: WORKFLOW_ID,
      workflowExecutionId: EXECUTION_ID,
      primitiveId: 'generate-report',
    });
  });

  it('omits absent workflow context instead of emitting empty values', () => {
    expect(
      buildWorkflowArtifactMetadata({
        artifactId: null,
        filename: 'output.csv',
        workflowId: undefined,
        workflowExecutionId: EXECUTION_ID,
        primitiveId: null,
      }),
    ).toEqual({
      resourceType: AuditRecordResourceType.WorkflowArtifact,
      filenames: ['output.csv'],
      workflowExecutionId: EXECUTION_ID,
    });
  });

  it('produces metadata that passes the strict server-side schema', () => {
    const metadata = buildChatArtifactMetadata(artifact(), CHAT_ID);

    expect(auditRecordMetadata.strict().safeParse(metadata).success).toBe(true);
  });
});

describe('summarizeAuditRecordMetadata', () => {
  it('returns an empty string when there is no metadata', () => {
    expect(summarizeAuditRecordMetadata(null)).toBe('');
  });

  it('summarizes filenames and ids', () => {
    expect(
      summarizeAuditRecordMetadata(buildChatArtifactMetadata(artifact(), CHAT_ID)),
    ).toBe(`Test Artifact.md | ids: ${ARTIFACT_ID}`);
  });

  it('falls back to the resource type when there is nothing else to show', () => {
    expect(
      summarizeAuditRecordMetadata({ resourceType: AuditRecordResourceType.ChatMessage }),
    ).toBe(AuditRecordResourceType.ChatMessage);
  });
});
