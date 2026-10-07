import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ArtifactContent from './ArtifactContent';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { Artifact } from '@/features/chat/types/message';
import { downloadArtifact } from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import { AuditRecordEvent, AuditRecordResourceType } from '@/features/shared/types/audit-record';
import { appTheme } from '@/providers/AppMantineProvider';

// Renders with the app's Mantine theme so `theme.other.fontWeights` tokens resolve.
const renderWithTheme = (ui: React.ReactElement) => render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

// Only downloadArtifact is stubbed — isServerDownloadedArtifact stays real
// because whether the download was already audited server-side is what the
// assertions below turn on.
jest.mock('@/features/chat/utils/artifacts/artifactHelperFunctions', () => ({
  ...jest.requireActual('@/features/chat/utils/artifacts/artifactHelperFunctions'),
  downloadArtifact: jest.fn(),
}));

const mockCreateAuditRecord = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: () => ({ mutate: mockCreateAuditRecord }),
}));

jest.mock('@/features/chat/hooks/usePushArtifactToGithub', () => ({
  usePushArtifactToGithub: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

const mockSaveArtifactVersionMutateAsync = jest.fn();

jest.mock('@/features/chat/hooks/useSaveChatArtifactVersion', () => ({
  useSaveChatArtifactVersion: () => ({
    mutateAsync: mockSaveArtifactVersionMutateAsync,
    isPending: false,
  }),
}));

let mockArtifactVersions: { versionNumber: number; content: string; createdAt: Date }[] = [];

jest.mock('@/features/chat/api/get-artifact-versions', () => ({
  __esModule: true,
  default: () => ({ data: { versions: mockArtifactVersions } }),
}));

jest.mock('@/features/shared/components/ArtifactEditor', () => ({
  __esModule: true,
  default: ({ onSave }: { onSave: (content: string) => void }) => (
    <button data-testid='mock-artifact-editor-save' onClick={() => onSave('edited content')}>Save</button>
  ),
}));

let mockGithubProviders: { id: string }[] = [];

jest.mock('@/features/shared/api/get-available-github-providers', () => ({
  __esModule: true,
  default: () => ({ data: { availableGitHubProviders: mockGithubProviders } }),
}));

jest.mock('@/features/chat/components/DocxPreview', () => ({
  __esModule: true,
  default: () => <div data-testid='docx-preview' />,
}));

jest.mock('@/features/video-generation/components/VideoPlayer', () => ({
  __esModule: true,
  default: () => <div data-testid='video-player' />,
}));

let mockVideoRenderStatusData: { status?: string; downloadUrl?: string; progress?: string } | undefined;

jest.mock('@/libs', () => ({
  trpc: {
    video: {
      renderToMp4: {
        useMutation: jest.fn(() => ({
          mutate: jest.fn(),
          isPending: false,
        })),
      },
      getRenderStatus: {
        useQuery: jest.fn(() => ({
          data: mockVideoRenderStatusData,
        })),
      },
    },
  },
}));

describe('ArtifactContent', () => {
  // Audit metadata only keeps ids the server can validate as uuids, so the
  // fixtures have to look like real records.
  const mockChatId = 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6';

  const mockArtifact: Artifact = {
    id: '0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62',
    fileExtension: '.md',
    label: 'Test Artifact',
    content: 'This is a test artifact content.',
    chatMessageId: 'ce1f6a2f-9f5f-4d4e-8f9a-5d3ba2a35f2b',
    githubPagesUrl: null,
    createdAt: new Date(),
  };

  const mockSetSelectedArtifact = jest.fn();
  const mockSetShowArtifactsContainer = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockArtifactVersions = [];
    mockVideoRenderStatusData = undefined;
    mockGithubProviders = [];
    (useChat as jest.Mock).mockReturnValue({
      setSelectedArtifact: mockSetSelectedArtifact,
      setShowArtifactsContainer: mockSetShowArtifactsContainer,
      chatId: mockChatId,
    });
  });

  it('renders Markdown component with content', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);
    
    const markdownComponent = screen.getByTestId('react-markdown');
    expect(markdownComponent).toBeInTheDocument();
    expect(markdownComponent).toHaveTextContent('This is a test artifact content.');
  });

  it('calls setSelectedArtifact with null when close button is clicked', () => {
    const { setSelectedArtifact } = useChat();

    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(setSelectedArtifact).toHaveBeenCalledWith(null);
  });

  it('records closing the artifact panel as a panel toggle', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    fireEvent.click(screen.getByLabelText('Close'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.TogglePanel,
      label: 'Close artifact panel',
    });
  });

  it('renders all action icons', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    const closeButton = screen.getByLabelText('Close');
    const copyButton = screen.getByLabelText('Copy');
    const downloadButton = screen.getByLabelText('Download');

    expect(closeButton).toBeInTheDocument();
    expect(copyButton).toBeInTheDocument();
    expect(downloadButton).toBeInTheDocument();
  });

  it('triggers download when download button is clicked', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    const downloadButton = screen.getByLabelText('Download');
    fireEvent.click(downloadButton);

    expect(downloadArtifact).toHaveBeenCalledWith(mockArtifact);
  });

  it('records a download audit record for client-generated artifacts', async () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    fireEvent.click(screen.getByLabelText('Download'));

    await waitFor(() => {
      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.DownloadArtifact,
        label: 'chat artifact "Test Artifact.md"',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [mockArtifact.id],
          filenames: ['Test Artifact.md'],
          chatId: mockChatId,
        },
      });
    });
  });

  it('records a download audit record when a video export finishes rendering', () => {
    mockVideoRenderStatusData = { status: 'done', downloadUrl: 'https://example.com/render.mp4' };

    const videoArtifact: Artifact = {
      ...mockArtifact,
      fileExtension: '.mp4',
      content: '[]',
    };

    renderWithTheme(<ArtifactContent artifact={videoArtifact} />);

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.DownloadArtifact,
      label: 'chat artifact "Test Artifact.mp4"',
      metadata: {
        resourceType: AuditRecordResourceType.ChatArtifact,
        resourceIds: [videoArtifact.id],
        filenames: ['Test Artifact.mp4'],
        chatId: mockChatId,
      },
    });
  });

  it('records the artifact identity when the copy button is clicked', async () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    fireEvent.click(screen.getByLabelText('Copy'));

    await waitFor(() => {
      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.CopyContentToClipboard,
        label: 'chat artifact "Test Artifact"',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [mockArtifact.id],
          filenames: ['Test Artifact.md'],
          chatId: mockChatId,
        },
      });
    });
  });

  it('does not record a client-side download audit record for artifacts without inline content', async () => {
    // Artifacts with no inline content, including unlisted extensions, are fetched from
    // /api/chat/artifacts/download, which audits the download server-side.
    const binaryArtifact: Artifact = {
      ...mockArtifact,
      fileExtension: '.mp3',
      content: '',
    };

    renderWithTheme(<ArtifactContent artifact={binaryArtifact} />);

    fireEvent.click(screen.getByLabelText('Download'));

    await waitFor(() => {
      expect(downloadArtifact).toHaveBeenCalledWith(binaryArtifact);
    });
    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('renders preview/code buttons when preview of artifact file extension is supported', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    const previewButton = screen.getByTestId('toggle-artifact-view-preview');
    const codeButton = screen.getByTestId('toggle-artifact-view-code');

    expect(previewButton).toBeInTheDocument();
    expect(codeButton).toBeInTheDocument();
  });

  it('toggles view mode when preview/code buttons are clicked', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);
    // Initially, preview button should be active
    const previewButton = screen.getByTestId('toggle-artifact-view-preview');
    const codeButton = screen.getByTestId('toggle-artifact-view-code');
    expect(previewButton).toHaveClass('active');
    expect(codeButton).not.toHaveClass('active');
    // Click on code button
    fireEvent.click(codeButton);
    // Now code button should be active and preview button should not
    expect(previewButton).not.toHaveClass('active');
    expect(codeButton).toHaveClass('active');
    // Click on preview button again
    fireEvent.click(previewButton);
    // Preview button should be active again
    expect(previewButton).toHaveClass('active');
    expect(codeButton).not.toHaveClass('active');
  });

  it('records a view-mode audit record when switching to the code view', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    fireEvent.click(screen.getByTestId('toggle-artifact-view-code'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.ToggleArtifactViewMode,
      label: 'chat artifact "Test Artifact.md" to code view',
      metadata: {
        resourceType: AuditRecordResourceType.ChatArtifact,
        resourceIds: [mockArtifact.id],
        filenames: ['Test Artifact.md'],
        chatId: mockChatId,
      },
    });
  });

  it('does not record a view-mode audit record when clicking the already-active view', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    fireEvent.click(screen.getByTestId('toggle-artifact-view-preview'));

    expect(mockCreateAuditRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: AuditRecordEvent.ToggleArtifactViewMode }),
    );
  });

  it('does not render preview/code buttons when preview of artifact file extension is unsupported', () => {
    const unsupportedArtifact: Artifact = {
      ...mockArtifact,
      fileExtension: '.js',
    };

    renderWithTheme(<ArtifactContent artifact={unsupportedArtifact} />);

    const previewButton = screen.queryByTestId('toggle-artifact-view-preview');
    const codeButton = screen.queryByTestId('toggle-artifact-view-code');
    
    expect(previewButton).not.toBeInTheDocument();
    expect(codeButton).not.toBeInTheDocument();
  });

  it('records opening the artifacts list as a panel toggle', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    fireEvent.click(screen.getByLabelText('Open artifacts list'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.TogglePanel,
      label: 'Open artifacts list',
    });
  });

  it('records an external navigation when the GitHub Pages link is clicked', () => {
    const publishedArtifact: Artifact = {
      ...mockArtifact,
      fileExtension: '.html',
      githubPagesUrl: 'https://myorg.github.io/my-repo/artifact.html',
    };

    renderWithTheme(<ArtifactContent artifact={publishedArtifact} />);

    fireEvent.click(screen.getByLabelText('View on GitHub Pages'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.ExternalNavigation,
      label: 'View on GitHub Pages',
      href: 'https://myorg.github.io/my-repo/artifact.html',
    });
  });

  it('does not render the version selector when the artifact has no saved history', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    expect(screen.queryByTestId('artifact-version-label')).not.toBeInTheDocument();
  });

  it('renders the version selector and shows the latest version by default', () => {
    mockArtifactVersions = [
      { versionNumber: 1, content: '# Original', createdAt: new Date('2024-01-01') },
      { versionNumber: 2, content: 'This is a test artifact content.', createdAt: new Date('2024-01-02') },
    ];

    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    expect(screen.getByTestId('artifact-version-label')).toHaveTextContent('Version 2 of 2');
  });

  it('shows an older version content and a restore button after navigating back', () => {
    mockArtifactVersions = [
      { versionNumber: 1, content: '# Original version content', createdAt: new Date('2024-01-01') },
      { versionNumber: 2, content: 'This is a test artifact content.', createdAt: new Date('2024-01-02') },
    ];

    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    fireEvent.click(screen.getByTestId('artifact-version-prev'));

    expect(screen.getByTestId('artifact-version-label')).toHaveTextContent('Version 1 of 2');
    expect(screen.getByTestId('react-markdown')).toHaveTextContent('# Original version content');
    expect(screen.getByTestId('artifact-version-restore')).toBeInTheDocument();
    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.NavigateArtifactVersion,
      label: 'chat artifact "Test Artifact.md" to version 1',
      metadata: {
        resourceType: AuditRecordResourceType.ChatArtifact,
        resourceIds: [mockArtifact.id],
        filenames: ['Test Artifact.md'],
        chatId: mockChatId,
      },
    });
  });

  it('records an edit-start audit record when the Edit button is clicked', () => {
    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    fireEvent.click(screen.getByLabelText('Edit'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.EditArtifact,
      label: 'chat artifact "Test Artifact.md"',
      metadata: {
        resourceType: AuditRecordResourceType.ChatArtifact,
        resourceIds: [mockArtifact.id],
        filenames: ['Test Artifact.md'],
        chatId: mockChatId,
      },
    });
  });

  it('records a save audit record when a new version is saved from the editor', async () => {
    mockSaveArtifactVersionMutateAsync.mockResolvedValue({
      artifactId: mockArtifact.id,
      content: 'edited content',
      versionNumber: 3,
    });

    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    fireEvent.click(screen.getByLabelText('Edit'));
    fireEvent.click(screen.getByTestId('mock-artifact-editor-save'));

    await waitFor(() => {
      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.SaveArtifactVersion,
        label: 'chat artifact "Test Artifact.md" (version 3)',
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [mockArtifact.id],
          filenames: ['Test Artifact.md'],
          chatId: mockChatId,
        },
      });
    });
  });

  it('disables the edit button while viewing an older version', () => {
    mockArtifactVersions = [
      { versionNumber: 1, content: '# Original version content', createdAt: new Date('2024-01-01') },
      { versionNumber: 2, content: 'This is a test artifact content.', createdAt: new Date('2024-01-02') },
    ];

    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    expect(screen.getByLabelText('Edit').closest('button')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('artifact-version-prev'));

    expect(screen.getByLabelText('Edit').closest('button')).toBeDisabled();
  });

  it('restores an older version by saving it as the new content', async () => {
    mockArtifactVersions = [
      { versionNumber: 1, content: '# Original version content', createdAt: new Date('2024-01-01') },
      { versionNumber: 2, content: 'This is a test artifact content.', createdAt: new Date('2024-01-02') },
    ];
    mockSaveArtifactVersionMutateAsync.mockResolvedValue({});

    renderWithTheme(<ArtifactContent artifact={mockArtifact} />);

    fireEvent.click(screen.getByTestId('artifact-version-prev'));
    fireEvent.click(screen.getByTestId('artifact-version-restore'));

    await waitFor(() => {
      expect(mockSaveArtifactVersionMutateAsync).toHaveBeenCalledWith({
        artifactId: mockArtifact.id,
        chatMessageId: mockArtifact.chatMessageId,
        content: '# Original version content',
      });
    });
    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.RestoreArtifactVersion,
      label: 'chat artifact "Test Artifact.md" to version 1',
      metadata: {
        resourceType: AuditRecordResourceType.ChatArtifact,
        resourceIds: [mockArtifact.id],
        filenames: ['Test Artifact.md'],
        chatId: mockChatId,
      },
    });
  });

  it('previews a document whose stored extension is upper-case', () => {
    renderWithTheme(<ArtifactContent artifact={{ ...mockArtifact, fileExtension: '.DOCX', content: '' }} />);

    expect(screen.getByTestId('docx-preview')).toBeInTheDocument();
  });

  it('offers edit and publish for an artifact of the current conversation', () => {
    mockGithubProviders = [{ id: 'provider-1' }];
    renderWithTheme(<ArtifactContent artifact={{ ...mockArtifact, fileExtension: '.html' }} />);

    expect(screen.getByLabelText('Edit')).toBeInTheDocument();
    expect(screen.getByLabelText('Publish to GitHub Pages')).toBeInTheDocument();
  });

  it('is read-only for an artifact opened from another conversation', () => {
    mockGithubProviders = [{ id: 'provider-1' }];
    renderWithTheme(<ArtifactContent artifact={{ ...mockArtifact, fileExtension: '.html', isExternal: true }} />);

    expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Publish to GitHub Pages')).not.toBeInTheDocument();
  });

  it('keeps the published page link for an artifact opened from another conversation', () => {
    renderWithTheme(
      <ArtifactContent artifact={{ ...mockArtifact, fileExtension: '.html', isExternal: true, githubPagesUrl: 'https://pages.example/a' }} />,
    );

    expect(screen.getByLabelText('View on GitHub Pages')).toBeInTheDocument();
    expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument();
  });
});
