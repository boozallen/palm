import { Artifact, MessageFeedbackRating } from '@/features/chat/types/message';
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

function workflowArtifactLabel(target: WorkflowArtifactContext): string {
  return `workflow artifact "${target.filename ?? 'unknown'}"`;
}

function messageFeedbackLabel(rating: MessageFeedbackRating): string {
  return `${rating} feedback for a chat response`;
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

    userUserGroupAttributionModal: {
      // Opening/closing via the sidebar trigger button, not Cancel or Escape.
      toggle: (label: string) => {
        createAuditRecord({ event: AuditRecordEvent.UserGroupAttributionModalToggle, label });
      },

      // Fires on Save/Confirm only — picking an option in the Select is just a draft.
      selectGroup: (label: string) => {
        createAuditRecord({ event: AuditRecordEvent.UserGroupAttributionModalSelectGroup, label });
      },

      // Cancel or Escape — distinct from the trigger toggle above. Clicking outside
      // the modal no longer closes it.
      close: (label: string) => {
        createAuditRecord({ event: AuditRecordEvent.UserGroupAttributionModalClose, label });
      },
    },

    idleWarningModal: {
      shown: () => {
        createAuditRecord({
          event: AuditRecordEvent.DisplayIdleWarningModal,
          label: 'idle session warning modal',
        });
      },

      extendSessionClicked: () => {
        createAuditRecord({
          event: AuditRecordEvent.ExtendSession,
          label: 'idle session warning modal',
        });
      },
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
          label: workflowArtifactLabel(target),
          metadata: buildWorkflowArtifactMetadata(target),
        });
      },
    },

    // The inline editor was opened for an artifact — not yet a change, just intent.
    editArtifact: {
      chatArtifact: (artifact: ChatArtifactTarget, chatId: string | null) => {
        createAuditRecord({
          event: AuditRecordEvent.EditArtifact,
          label: artifactLabel(artifact, true),
          metadata: buildChatArtifactMetadata(artifact, chatId),
        });
      },

      workflowArtifact: (target: WorkflowArtifactContext) => {
        createAuditRecord({
          event: AuditRecordEvent.EditArtifact,
          label: workflowArtifactLabel(target),
          metadata: buildWorkflowArtifactMetadata(target),
        });
      },
    },

    // The inline editor was closed without saving.
    cancelEditArtifact: {
      chatArtifact: (artifact: ChatArtifactTarget, chatId: string | null) => {
        createAuditRecord({
          event: AuditRecordEvent.CancelEditArtifact,
          label: artifactLabel(artifact, true),
          metadata: buildChatArtifactMetadata(artifact, chatId),
        });
      },

      workflowArtifact: (target: WorkflowArtifactContext) => {
        createAuditRecord({
          event: AuditRecordEvent.CancelEditArtifact,
          label: workflowArtifactLabel(target),
          metadata: buildWorkflowArtifactMetadata(target),
        });
      },
    },

    // Stepping between an artifact's saved versions with the prev/next arrows.
    navigateArtifactVersion: {
      chatArtifact: (artifact: ChatArtifactTarget, chatId: string | null, versionNumber: number) => {
        createAuditRecord({
          event: AuditRecordEvent.NavigateArtifactVersion,
          label: `${artifactLabel(artifact, true)} to version ${versionNumber}`,
          metadata: buildChatArtifactMetadata(artifact, chatId),
        });
      },

      workflowArtifact: (target: WorkflowArtifactContext, versionNumber: number) => {
        createAuditRecord({
          event: AuditRecordEvent.NavigateArtifactVersion,
          label: `${workflowArtifactLabel(target)} to version ${versionNumber}`,
          metadata: buildWorkflowArtifactMetadata(target),
        });
      },
    },

    // A new version was created from an inline edit.
    saveArtifactVersion: {
      chatArtifact: (artifact: ChatArtifactTarget, chatId: string | null, versionNumber: number) => {
        createAuditRecord({
          event: AuditRecordEvent.SaveArtifactVersion,
          label: `${artifactLabel(artifact, true)} (version ${versionNumber})`,
          metadata: buildChatArtifactMetadata(artifact, chatId),
        });
      },

      workflowArtifact: (target: WorkflowArtifactContext, versionNumber: number) => {
        createAuditRecord({
          event: AuditRecordEvent.SaveArtifactVersion,
          label: `${workflowArtifactLabel(target)} (version ${versionNumber})`,
          metadata: buildWorkflowArtifactMetadata(target),
        });
      },
    },

    // A new version was created by restoring an older one's content.
    restoreArtifactVersion: {
      chatArtifact: (artifact: ChatArtifactTarget, chatId: string | null, versionNumber: number) => {
        createAuditRecord({
          event: AuditRecordEvent.RestoreArtifactVersion,
          label: `${artifactLabel(artifact, true)} to version ${versionNumber}`,
          metadata: buildChatArtifactMetadata(artifact, chatId),
        });
      },

      workflowArtifact: (target: WorkflowArtifactContext, versionNumber: number) => {
        createAuditRecord({
          event: AuditRecordEvent.RestoreArtifactVersion,
          label: `${workflowArtifactLabel(target)} to version ${versionNumber}`,
          metadata: buildWorkflowArtifactMetadata(target),
        });
      },
    },

    // The feedback modal was opened by clicking a thumbs up/down button — not
    // yet a submitted rating, which is audited server-side when it saves.
    messageFeedback: {
      open: (rating: MessageFeedbackRating, chatMessageId: string | undefined, chatId: string | null) => {
        createAuditRecord({
          event: AuditRecordEvent.OpenMessageFeedbackModal,
          label: messageFeedbackLabel(rating),
          metadata: buildChatMessageMetadata(chatMessageId, chatId),
        });
      },

      cancel: (rating: MessageFeedbackRating, chatMessageId: string | undefined, chatId: string | null) => {
        createAuditRecord({
          event: AuditRecordEvent.CancelMessageFeedbackModal,
          label: messageFeedbackLabel(rating),
          metadata: buildChatMessageMetadata(chatMessageId, chatId),
        });
      },
    },

    // Switching an artifact's pane between the rendered preview and raw code/text.
    toggleArtifactViewMode: {
      chatArtifact: (artifact: ChatArtifactTarget, chatId: string | null, viewMode: 'preview' | 'code') => {
        createAuditRecord({
          event: AuditRecordEvent.ToggleArtifactViewMode,
          label: `${artifactLabel(artifact, true)} to ${viewMode} view`,
          metadata: buildChatArtifactMetadata(artifact, chatId),
        });
      },
    },
  };
}
