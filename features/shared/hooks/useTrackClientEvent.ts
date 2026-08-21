import { Artifact } from '@/features/chat/types/message';
import { useCreateClientSideAuditRecord } from '@/features/shared/api/create-client-side-audit-record';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';
import {
  buildChatArtifactMetadata,
  buildChatArtifactsMetadata,
  buildChatMessageMetadata,
  buildWorkflowArtifactMetadata,
  WorkflowArtifactContext,
} from '@/features/shared/utils/auditRecordMetadata';

// The single entry point for client-recorded audit events. Each method pairs an
// event with the label wording and metadata builder that belong to it, so a call
// site never picks either by hand — the mismatches are silent and only surface
// as unreadable analytics.
//
// None of these intercept the interaction: the caller performs it, and the audit
// mutation is fire-and-forget.

type ChatArtifactTarget = Pick<Artifact, 'id' | 'label' | 'fileExtension'>;

// Centralized so copy and download can't name the same file differently.
function artifactLabel(artifact: ChatArtifactTarget, withExtension: boolean): string {
  return `chat artifact "${artifact.label}${withExtension ? artifact.fileExtension : ''}"`;
}

export function useTrackClientEvent() {
  const { mutate: createAuditRecord } = useCreateClientSideAuditRecord();

  return {
    // An in-app destination. The href is what makes the record a navigation
    // rather than a plain control click.
    navigate: (label: string, href?: string) => {
      createAuditRecord({ event: AuditRecordEvent.Navigation, label, href });
    },

    // A sidebar or panel opening/closing — on-screen only, never a navigation.
    togglePanel: (label: string) => {
      createAuditRecord({ event: AuditRecordEvent.TogglePanel, label });
    },

    // A text selection inside an assistant response. Takes the character count,
    // never the text — the selection is model output the user is reading, and the
    // audit trail is not the place to store response content. The count is enough
    // to tell a stray double-click from a deliberate pull-quote.
    highlightResponseText: (
      selectionLength: number,
      chatMessageId: string | undefined,
      chatId: string | null,
    ) => {
      createAuditRecord({
        event: AuditRecordEvent.HighlightResponseText,
        label: `${selectionLength} characters of a chat response`,
        metadata: buildChatMessageMetadata(chatMessageId, chatId),
      });
    },

    // A destination that leaves the app — a new tab, a mailto, a docs site.
    externalLink: (label: string, href?: string) => {
      createAuditRecord({ event: AuditRecordEvent.ExternalNavigation, label, href });
    },

    // The externally configured access-request destination. Distinct from
    // externalLink so access requests stay countable on their own.
    requestAccess: (label: string, href?: string) => {
      createAuditRecord({ event: AuditRecordEvent.RequestAccessToPalm, label, href });
    },

    copy: {
      // Content with no backing resource row — a join code, a code block. The
      // label is the only context, so no metadata is attached.
      content: (label: string) => {
        createAuditRecord({ event: AuditRecordEvent.CopyContentToClipboard, label });
      },

      chatArtifact: (artifact: ChatArtifactTarget, chatId: string | null) => {
        createAuditRecord({
          event: AuditRecordEvent.CopyContentToClipboard,
          label: artifactLabel(artifact, false),
          metadata: buildChatArtifactMetadata(artifact, chatId),
        });
      },

      chatMessage: (chatMessageId: string | undefined, chatId: string | null) => {
        createAuditRecord({
          event: AuditRecordEvent.CopyContentToClipboard,
          label: 'chat message content',
          metadata: buildChatMessageMetadata(chatMessageId, chatId),
        });
      },

      workflowArtifact: (target: WorkflowArtifactContext) => {
        createAuditRecord({
          event: AuditRecordEvent.CopyContentToClipboard,
          label: 'workflow artifact content',
          metadata: buildWorkflowArtifactMetadata(target),
        });
      },
    },

    download: {
      // The extension is part of the label here but not on copy: a download
      // produces a file the user can point at, a clipboard write doesn't.
      chatArtifact: (artifact: ChatArtifactTarget, chatId: string | null) => {
        createAuditRecord({
          event: AuditRecordEvent.DownloadArtifact,
          label: artifactLabel(artifact, true),
          metadata: buildChatArtifactMetadata(artifact, chatId),
        });
      },

      // A bulk download stays one record while still naming every file.
      allChatArtifacts: (artifacts: ReadonlyArray<ChatArtifactTarget>, chatId: string | null) => {
        createAuditRecord({
          event: AuditRecordEvent.DownloadArtifact,
          label: `all ${artifacts.length} chat artifacts`,
          metadata: buildChatArtifactsMetadata(artifacts, chatId),
        });
      },

      workflowArtifact: (target: WorkflowArtifactContext) => {
        createAuditRecord({
          event: AuditRecordEvent.DownloadArtifact,
          label: `workflow artifact "${target.filename ?? 'unknown'}"`,
          metadata: buildWorkflowArtifactMetadata(target),
        });
      },
    },
  };
}
