import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes/index';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';

const ARTIFACT_ID = '0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62';
const CHAT_ID = 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6';

describe('createClientSideAuditRecord', () => {
  const mockAuditor = {
    createAuditRecord: jest.fn(),
  };

  const ctx = {
    userRole: UserRole.User,
    userId: 'test-user-id',
    auditor: mockAuditor,
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an audit record for a navigation (with href)', async () => {
    const caller = sharedRouter.createCaller(ctx);

    const result = await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.Navigation,
      label: 'Chat',
      href: '/chat',
      outcome: AuditRecordOutcome.Info,
    });

    expect(result.success).toBe(true);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.Navigation,
      outcome: AuditRecordOutcome.Info,
      description: 'User clicked "Chat (/chat)"',
    });
  });

  it('should pass the client-supplied referer through to the auditor', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.Navigation,
      label: 'Workflows',
      href: '/workflows',
      referer: 'http://localhost:3000/chat',
      outcome: AuditRecordOutcome.Info,
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ referer: 'http://localhost:3000/chat' }),
    );
  });

  it('should preserve a URL hash in the referer', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.Navigation,
      label: 'Access Control',
      href: '/settings#access-control',
      referer: 'http://localhost:3000/settings#audit-records',
      outcome: AuditRecordOutcome.Info,
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        referer: 'http://localhost:3000/settings#audit-records',
      }),
    );
  });

  it('should build a description without an href', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.Navigation,
      label: 'Settings',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'User clicked "Settings"' }),
    );
  });

  it('should default the outcome to Info when not provided', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.Navigation,
      label: 'Settings',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: AuditRecordOutcome.Info }),
    );
  });

  it('should create an audit record for an external navigation', async () => {
    const caller = sharedRouter.createCaller(ctx);

    const result = await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.ExternalNavigation,
      label: 'View on arXiv',
      href: 'https://arxiv.org/abs/2401.00001',
      outcome: AuditRecordOutcome.Info,
    });

    expect(result.success).toBe(true);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.ExternalNavigation,
      outcome: AuditRecordOutcome.Info,
      description: 'User opened external link "View on arXiv" (https://arxiv.org/abs/2401.00001)',
    });
  });

  it('should build an external navigation description without an href', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.ExternalNavigation,
      label: 'support@example.com',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'User opened external link "support@example.com"' }),
    );
  });

  it('should create an audit record for a request access to PALM click', async () => {
    const caller = sharedRouter.createCaller(ctx);

    const result = await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.RequestAccessToPalm,
      label: 'Join User Group Dialog',
      href: 'https://example.com/get-access',
    });

    expect(result.success).toBe(true);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.RequestAccessToPalm,
        description:
          'User requested access to PALM via "Join User Group Dialog" (https://example.com/get-access)',
      }),
    );
  });

  it('should build a request access description without an href', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.RequestAccessToPalm,
      label: 'First Login Modal',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'User requested access to PALM via "First Login Modal"',
      }),
    );
  });

  it('should build a description for a panel toggle', async () => {
    const caller = sharedRouter.createCaller(ctx);

    const result = await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.TogglePanel,
      label: 'Close artifacts list',
    });

    expect(result.success).toBe(true);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.TogglePanel,
        description: 'User toggled Close artifacts list',
      }),
    );
  });

  // The navigation views parse `User clicked "Label (/path)"`. A panel toggle
  // must not produce that shape, or it would read as a visited page.
  it('should not describe a panel toggle with the navigation click wording', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.TogglePanel,
      label: 'Collapse sidebar',
    });

    const { description } = mockAuditor.createAuditRecord.mock.calls[0][0];
    expect(description).not.toMatch(/User clicked "/);
  });

  it('should build a description for a response-text highlight', async () => {
    const caller = sharedRouter.createCaller(ctx);

    const result = await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.HighlightResponseText,
      label: '42 characters of a chat response',
    });

    expect(result.success).toBe(true);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.HighlightResponseText,
        description: 'User highlighted 42 characters of a chat response',
      }),
    );
  });

  it('should build a description for a copy-to-clipboard interaction', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.CopyContentToClipboard,
      label: 'chat message content',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.CopyContentToClipboard,
        description: 'User copied chat message content',
      }),
    );
  });

  it('should build a description for an artifact download', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.DownloadArtifact,
      label: 'chat artifact "report.docx"',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.DownloadArtifact,
        description: 'User downloaded chat artifact "report.docx"',
      }),
    );
  });

  it('should build a description for opening the artifact editor', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.EditArtifact,
      label: 'chat artifact "report.docx"',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.EditArtifact,
        description: 'User started editing chat artifact "report.docx"',
      }),
    );
  });

  it('should build a description for navigating between artifact versions', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.NavigateArtifactVersion,
      label: 'chat artifact "report.docx" to version 2',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.NavigateArtifactVersion,
        description: 'User navigated chat artifact "report.docx" to version 2',
      }),
    );
  });

  it('should build a description for saving a new artifact version', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.SaveArtifactVersion,
      label: 'chat artifact "report.docx" (version 3)',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.SaveArtifactVersion,
        description: 'User saved chat artifact "report.docx" (version 3)',
      }),
    );
  });

  it('should build a description for restoring an artifact version', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.RestoreArtifactVersion,
      label: 'chat artifact "report.docx" to version 1',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.RestoreArtifactVersion,
        description: 'User restored chat artifact "report.docx" to version 1',
      }),
    );
  });

  it('should pass resource metadata through to the auditor', async () => {
    const caller = sharedRouter.createCaller(ctx);

    const metadata = {
      resourceType: AuditRecordResourceType.ChatArtifact,
      resourceIds: [ARTIFACT_ID],
      filenames: ['report.docx'],
      chatId: CHAT_ID,
    };

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.DownloadArtifact,
      label: 'chat artifact "report.docx"',
      metadata,
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ metadata }),
    );
  });

  it('should reject metadata containing keys outside the schema', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.createClientSideAuditRecord({
        event: AuditRecordEvent.DownloadArtifact,
        label: 'chat artifact "report.docx"',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          // The client must not be able to smuggle arbitrary JSON into the trail.
          injected: 'arbitrary value',
        },
      } as unknown as Parameters<typeof caller.createClientSideAuditRecord>[0]),
    ).rejects.toThrow();

    expect(mockAuditor.createAuditRecord).not.toHaveBeenCalled();
  });

  it('should reject resource ids that are not uuids', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.createClientSideAuditRecord({
        event: AuditRecordEvent.DownloadArtifact,
        label: 'chat artifact "report.docx"',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: ['not-a-uuid'],
        },
      }),
    ).rejects.toThrow();

    expect(mockAuditor.createAuditRecord).not.toHaveBeenCalled();
  });

  it('should build a description for toggling the user group attribution modal', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.UserGroupAttributionModalToggle,
      label: 'opened the AI usage & cost attribution control',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.UserGroupAttributionModalToggle,
        description: 'User opened the AI usage & cost attribution control',
      }),
    );
  });

  it('should build a description for selecting a user group attribution', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.UserGroupAttributionModalSelectGroup,
      label: 'set their default user group to "Finance"',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.UserGroupAttributionModalSelectGroup,
        description: 'User set their default user group to "Finance"',
      }),
    );
  });

  it('should build a description for closing the user group attribution modal', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await caller.createClientSideAuditRecord({
      event: AuditRecordEvent.UserGroupAttributionModalClose,
      label: 'dismissed the user group attribution prompt without selecting a group',
    });

    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditRecordEvent.UserGroupAttributionModalClose,
        description: 'User dismissed the user group attribution prompt without selecting a group',
      }),
    );
  });

  it('should reject events that are not client-recordable', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await expect(
      caller.createClientSideAuditRecord({
        event: AuditRecordEvent.UserSignIn,
        label: 'Forged sign-in',
      }),
    ).rejects.toThrow();

    expect(mockAuditor.createAuditRecord).not.toHaveBeenCalled();
  });
});
