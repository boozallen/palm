import { renderHook } from '@testing-library/react';

import { useTrackClientEvent } from './useTrackClientEvent';
import {
  AuditRecordEvent,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';
import { MessageFeedbackRating } from '@/features/chat/types/message';

const mockCreateAuditRecord = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: jest.fn(() => ({ mutate: mockCreateAuditRecord })),
}));

const CHAT_ID = '11111111-1111-4111-8111-111111111111';
const ARTIFACT_ID = '22222222-2222-4222-8222-222222222222';
const MESSAGE_ID = '33333333-3333-4333-8333-333333333333';
const WORKFLOW_ID = '44444444-4444-4444-8444-444444444444';
const EXECUTION_ID = '55555555-5555-4555-8555-555555555555';

const artifact = {
  id: ARTIFACT_ID,
  label: 'report',
  fileExtension: '.docx',
};

describe('useTrackClientEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('navigation', () => {
    it('records an in-app navigation with the destination', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.navigate('Settings', '/settings');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.Navigation,
        label: 'Settings',
        href: '/settings',
      });
    });

    it('records a navigational control that has no destination', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.navigate('Prompt Library');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.Navigation,
        label: 'Prompt Library',
        href: undefined,
      });
    });

    it('records an external destination as EXTERNAL_NAVIGATION, not NAVIGATION', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.externalLink('View on arXiv', 'https://arxiv.org/abs/2401.00001');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.ExternalNavigation,
        label: 'View on arXiv',
        href: 'https://arxiv.org/abs/2401.00001',
      });
    });

    it('records a label-only external link when no href is supplied', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.externalLink('support@example.com');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.ExternalNavigation,
        label: 'support@example.com',
        href: undefined,
      });
    });

    it('records an access request separately from a plain external link', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.requestAccess('First Login Modal', 'https://example.com/get-access');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.RequestAccessToPalm,
        label: 'First Login Modal',
        href: 'https://example.com/get-access',
      });
    });
  });

  describe('togglePanel', () => {
    it('records a panel toggle as TOGGLE_PANEL, not a navigation', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.togglePanel('Close artifacts list');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.TogglePanel,
        label: 'Close artifacts list',
      });
    });

    // The bug this event exists to prevent: a panel toggle recorded as an
    // href-less NAVIGATION became a page in the transition matrix and counted
    // toward a session's navigations, even though the user never left the page.
    it('never attaches an href to a panel toggle', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.togglePanel('Collapse sources sidebar');

      const [[call]] = mockCreateAuditRecord.mock.calls;
      expect(call).not.toHaveProperty('href');
      expect(call.event).not.toBe(AuditRecordEvent.Navigation);
    });
  });

  describe('highlightResponseText', () => {
    it('records the highlight against the message and its chat', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.highlightResponseText(42, MESSAGE_ID, CHAT_ID);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.HighlightResponseText,
        label: '42 characters of a chat response',
        metadata: {
          resourceType: AuditRecordResourceType.ChatMessage,
          resourceIds: [MESSAGE_ID],
          chatMessageId: MESSAGE_ID,
          chatId: CHAT_ID,
        },
      });
    });

    // Highlighted text is model output the user is reading. Recording it would
    // put response content in the audit table, which has no business holding it.
    it('records only the length, never the highlighted text', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.highlightResponseText('patient SSN 123-45-6789'.length, MESSAGE_ID, CHAT_ID);

      const [[call]] = mockCreateAuditRecord.mock.calls;
      expect(JSON.stringify(call)).not.toContain('123-45-6789');
      expect(call.label).toBe('23 characters of a chat response');
    });
  });

  describe('messageFeedback', () => {
    it('records opening the modal for a positive rating', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.messageFeedback.open(MessageFeedbackRating.Positive, MESSAGE_ID, CHAT_ID);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.OpenMessageFeedbackModal,
        label: 'positive feedback for a chat response',
        metadata: {
          resourceType: AuditRecordResourceType.ChatMessage,
          resourceIds: [MESSAGE_ID],
          chatMessageId: MESSAGE_ID,
          chatId: CHAT_ID,
        },
      });
    });

    it('records opening the modal for a negative rating', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.messageFeedback.open(MessageFeedbackRating.Negative, MESSAGE_ID, CHAT_ID);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.OpenMessageFeedbackModal,
        label: 'negative feedback for a chat response',
        metadata: {
          resourceType: AuditRecordResourceType.ChatMessage,
          resourceIds: [MESSAGE_ID],
          chatMessageId: MESSAGE_ID,
          chatId: CHAT_ID,
        },
      });
    });

    it('records closing the modal without submitting as a separate event from opening it', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.messageFeedback.cancel(MessageFeedbackRating.Positive, MESSAGE_ID, CHAT_ID);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.CancelMessageFeedbackModal,
        label: 'positive feedback for a chat response',
        metadata: {
          resourceType: AuditRecordResourceType.ChatMessage,
          resourceIds: [MESSAGE_ID],
          chatMessageId: MESSAGE_ID,
          chatId: CHAT_ID,
        },
      });
    });
  });

  describe('copy', () => {
    it('records content with no backing resource without metadata', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.copy.content('user group join code');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.CopyContentToClipboard,
        label: 'user group join code',
      });
    });

    it('records a chat artifact copy with its resource metadata', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.copy.chatArtifact(artifact, CHAT_ID);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.CopyContentToClipboard,
        label: 'chat artifact "report"',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          chatId: CHAT_ID,
        },
      });
    });

    it('records a chat message copy against the message and its chat', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.copy.chatMessage(MESSAGE_ID, CHAT_ID);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.CopyContentToClipboard,
        label: 'chat message content',
        metadata: {
          resourceType: AuditRecordResourceType.ChatMessage,
          resourceIds: [MESSAGE_ID],
          chatMessageId: MESSAGE_ID,
          chatId: CHAT_ID,
        },
      });
    });

    it('records a workflow artifact copy against its execution and primitive', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.copy.workflowArtifact({
        artifactId: ARTIFACT_ID,
        filename: 'report.docx',
        workflowId: WORKFLOW_ID,
        workflowExecutionId: EXECUTION_ID,
        primitiveId: 'artifact-1',
      });

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.CopyContentToClipboard,
        label: 'workflow artifact content',
        metadata: {
          resourceType: AuditRecordResourceType.WorkflowArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          workflowId: WORKFLOW_ID,
          workflowExecutionId: EXECUTION_ID,
          primitiveId: 'artifact-1',
        },
      });
    });
  });

  describe('download', () => {
    it('records a chat artifact download naming the file the user got', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.download.chatArtifact(artifact, CHAT_ID);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.DownloadArtifact,
        label: 'chat artifact "report.docx"',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          chatId: CHAT_ID,
        },
      });
    });

    it('keeps a bulk download to one record that names every file', () => {
      const { result } = renderHook(() => useTrackClientEvent());
      const second = { id: MESSAGE_ID, label: 'summary', fileExtension: '.md' };

      result.current.download.allChatArtifacts([artifact, second], CHAT_ID);

      expect(mockCreateAuditRecord).toHaveBeenCalledTimes(1);
      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.DownloadArtifact,
        label: 'all 2 chat artifacts',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [ARTIFACT_ID, MESSAGE_ID],
          filenames: ['report.docx', 'summary.md'],
          chatId: CHAT_ID,
        },
      });
    });

    it('records a workflow artifact download against its execution', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.download.workflowArtifact({
        artifactId: ARTIFACT_ID,
        filename: 'report.docx',
        workflowId: WORKFLOW_ID,
        workflowExecutionId: EXECUTION_ID,
        primitiveId: 'artifact-1',
      });

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.DownloadArtifact,
        label: 'workflow artifact "report.docx"',
        metadata: {
          resourceType: AuditRecordResourceType.WorkflowArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          workflowId: WORKFLOW_ID,
          workflowExecutionId: EXECUTION_ID,
          primitiveId: 'artifact-1',
        },
      });
    });
  });

  describe('userUserGroupAttributionModal', () => {
    it('records toggling the modal open/closed via the trigger button', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.userUserGroupAttributionModal.toggle('opened the AI usage & cost attribution control');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.UserGroupAttributionModalToggle,
        label: 'opened the AI usage & cost attribution control',
      });
    });

    it('records selecting/changing the user group as its own event, distinct from toggle', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.userUserGroupAttributionModal.selectGroup('set their default user group to "Finance"');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.UserGroupAttributionModalSelectGroup,
        label: 'set their default user group to "Finance"',
      });
    });

    it('records closing the modal (Cancel, Escape) as its own event', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.userUserGroupAttributionModal.close('dismissed the user group attribution prompt without selecting a group');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.UserGroupAttributionModalClose,
        label: 'dismissed the user group attribution prompt without selecting a group',
      });
    });
  });

  describe('editArtifact', () => {
    it('records opening the editor for a chat artifact', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.editArtifact.chatArtifact(artifact, CHAT_ID);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.EditArtifact,
        label: 'chat artifact "report.docx"',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          chatId: CHAT_ID,
        },
      });
    });

    it('records opening the editor for a workflow artifact', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.editArtifact.workflowArtifact({
        artifactId: ARTIFACT_ID,
        filename: 'report.docx',
        workflowId: WORKFLOW_ID,
        workflowExecutionId: EXECUTION_ID,
        primitiveId: 'artifact-1',
      });

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.EditArtifact,
        label: 'workflow artifact "report.docx"',
        metadata: {
          resourceType: AuditRecordResourceType.WorkflowArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          workflowId: WORKFLOW_ID,
          workflowExecutionId: EXECUTION_ID,
          primitiveId: 'artifact-1',
        },
      });
    });
  });

  describe('cancelEditArtifact', () => {
    it('records closing the editor for a chat artifact without saving', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.cancelEditArtifact.chatArtifact(artifact, CHAT_ID);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.CancelEditArtifact,
        label: 'chat artifact "report.docx"',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          chatId: CHAT_ID,
        },
      });
    });

    it('records closing the editor for a workflow artifact without saving', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.cancelEditArtifact.workflowArtifact({
        artifactId: ARTIFACT_ID,
        filename: 'report.docx',
        workflowId: WORKFLOW_ID,
        workflowExecutionId: EXECUTION_ID,
        primitiveId: 'artifact-1',
      });

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.CancelEditArtifact,
        label: 'workflow artifact "report.docx"',
        metadata: {
          resourceType: AuditRecordResourceType.WorkflowArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          workflowId: WORKFLOW_ID,
          workflowExecutionId: EXECUTION_ID,
          primitiveId: 'artifact-1',
        },
      });
    });
  });

  describe('navigateArtifactVersion', () => {
    it('records stepping to a chat artifact version', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.navigateArtifactVersion.chatArtifact(artifact, CHAT_ID, 2);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.NavigateArtifactVersion,
        label: 'chat artifact "report.docx" to version 2',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          chatId: CHAT_ID,
        },
      });
    });

    it('records stepping to a workflow artifact version', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.navigateArtifactVersion.workflowArtifact({
        artifactId: ARTIFACT_ID,
        filename: 'report.docx',
        workflowId: WORKFLOW_ID,
        workflowExecutionId: EXECUTION_ID,
        primitiveId: 'artifact-1',
      }, 2);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.NavigateArtifactVersion,
        label: 'workflow artifact "report.docx" to version 2',
        metadata: {
          resourceType: AuditRecordResourceType.WorkflowArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          workflowId: WORKFLOW_ID,
          workflowExecutionId: EXECUTION_ID,
          primitiveId: 'artifact-1',
        },
      });
    });
  });

  describe('saveArtifactVersion', () => {
    it('records saving a new chat artifact version', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.saveArtifactVersion.chatArtifact(artifact, CHAT_ID, 3);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.SaveArtifactVersion,
        label: 'chat artifact "report.docx" (version 3)',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          chatId: CHAT_ID,
        },
      });
    });

    it('records saving a new workflow artifact version', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.saveArtifactVersion.workflowArtifact({
        artifactId: ARTIFACT_ID,
        filename: 'report.docx',
        workflowId: WORKFLOW_ID,
        workflowExecutionId: EXECUTION_ID,
        primitiveId: 'artifact-1',
      }, 3);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.SaveArtifactVersion,
        label: 'workflow artifact "report.docx" (version 3)',
        metadata: {
          resourceType: AuditRecordResourceType.WorkflowArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          workflowId: WORKFLOW_ID,
          workflowExecutionId: EXECUTION_ID,
          primitiveId: 'artifact-1',
        },
      });
    });
  });

  describe('restoreArtifactVersion', () => {
    it('records restoring a chat artifact to an older version', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.restoreArtifactVersion.chatArtifact(artifact, CHAT_ID, 1);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.RestoreArtifactVersion,
        label: 'chat artifact "report.docx" to version 1',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          chatId: CHAT_ID,
        },
      });
    });

    it('records restoring a workflow artifact to an older version', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.restoreArtifactVersion.workflowArtifact({
        artifactId: ARTIFACT_ID,
        filename: 'report.docx',
        workflowId: WORKFLOW_ID,
        workflowExecutionId: EXECUTION_ID,
        primitiveId: 'artifact-1',
      }, 1);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.RestoreArtifactVersion,
        label: 'workflow artifact "report.docx" to version 1',
        metadata: {
          resourceType: AuditRecordResourceType.WorkflowArtifact,
          resourceIds: [ARTIFACT_ID],
          filenames: ['report.docx'],
          workflowId: WORKFLOW_ID,
          workflowExecutionId: EXECUTION_ID,
          primitiveId: 'artifact-1',
        },
      });
    });
  });

  describe('idleWarningModal', () => {
    it('records that the idle session warning modal was shown', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.idleWarningModal.shown();

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.DisplayIdleWarningModal,
        label: 'idle session warning modal',
      });
    });

    it('records that the user clicked "Continue session" on the idle warning modal', () => {
      const { result } = renderHook(() => useTrackClientEvent());

      result.current.idleWarningModal.extendSessionClicked();

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.ExtendSession,
        label: 'idle session warning modal',
      });
    });
  });

  // The bug this hook exists to prevent: copy and download described the same
  // artifact differently when each call site built its own label.
  it('describes the same artifact consistently across copy and download', () => {
    const { result } = renderHook(() => useTrackClientEvent());

    result.current.copy.chatArtifact(artifact, CHAT_ID);
    result.current.download.chatArtifact(artifact, CHAT_ID);

    const [copyCall, downloadCall] = mockCreateAuditRecord.mock.calls;

    expect(copyCall[0].metadata).toEqual(downloadCall[0].metadata);
    // Only the extension differs: a download produces a file, a copy doesn't.
    expect(copyCall[0].label).toBe('chat artifact "report"');
    expect(downloadCall[0].label).toBe('chat artifact "report.docx"');
  });

  it('drops placeholder ids that would fail server-side uuid validation', () => {
    const { result } = renderHook(() => useTrackClientEvent());

    result.current.copy.chatMessage('pending', CHAT_ID);

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.CopyContentToClipboard,
      label: 'chat message content',
      metadata: {
        resourceType: AuditRecordResourceType.ChatMessage,
        chatId: CHAT_ID,
      },
    });
  });
});
