import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ArtifactContent from './ArtifactContent';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { Artifact } from '@/features/chat/types/message';
import { downloadArtifact } from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import { AuditRecordEvent, AuditRecordResourceType } from '@/features/shared/types/audit-record';

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

jest.mock('@/features/shared/api/get-available-github-providers', () => ({
  __esModule: true,
  default: () => ({ data: { availableGitHubProviders: [] } }),
}));

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
          data: undefined,
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
    (useChat as jest.Mock).mockReturnValue({
      setSelectedArtifact: mockSetSelectedArtifact,
      setShowArtifactsContainer: mockSetShowArtifactsContainer,
      chatId: mockChatId,
    });
  });

  it('renders Markdown component with content', () => {
    render(<ArtifactContent artifact={mockArtifact} />);
    
    const markdownComponent = screen.getByTestId('react-markdown');
    expect(markdownComponent).toBeInTheDocument();
    expect(markdownComponent).toHaveTextContent('This is a test artifact content.');
  });

  it('calls setSelectedArtifact with null when close button is clicked', () => {
    const { setSelectedArtifact } = useChat();

    render(<ArtifactContent artifact={mockArtifact} />);

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(setSelectedArtifact).toHaveBeenCalledWith(null);
  });

  it('renders all action icons', () => {
    render(<ArtifactContent artifact={mockArtifact} />);

    const closeButton = screen.getByLabelText('Close');
    const copyButton = screen.getByLabelText('Copy');
    const downloadButton = screen.getByLabelText('Download');

    expect(closeButton).toBeInTheDocument();
    expect(copyButton).toBeInTheDocument();
    expect(downloadButton).toBeInTheDocument();
  });

  it('triggers download when download button is clicked', () => {
    render(<ArtifactContent artifact={mockArtifact} />);

    const downloadButton = screen.getByLabelText('Download');
    fireEvent.click(downloadButton);

    expect(downloadArtifact).toHaveBeenCalledWith(mockArtifact);
  });

  it('records a download audit record for client-generated artifacts', async () => {
    render(<ArtifactContent artifact={mockArtifact} />);

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

  it('records the artifact identity when the copy button is clicked', async () => {
    render(<ArtifactContent artifact={mockArtifact} />);

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

  it('does not record a client-side download audit record for binary artifacts served by the audited API route', async () => {
    // Binary artifacts with no inline content are fetched from
    // /api/chat/artifacts/download, which audits the download server-side.
    const binaryArtifact: Artifact = {
      ...mockArtifact,
      fileExtension: '.pdf',
      content: '',
    };

    render(<ArtifactContent artifact={binaryArtifact} />);

    fireEvent.click(screen.getByLabelText('Download'));

    await waitFor(() => {
      expect(downloadArtifact).toHaveBeenCalledWith(binaryArtifact);
    });
    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('renders preview/code buttons when preview of artifact file extension is supported', () => {
    render(<ArtifactContent artifact={mockArtifact} />);

    const previewButton = screen.getByTestId('toggle-artifact-view-preview');
    const codeButton = screen.getByTestId('toggle-artifact-view-code');

    expect(previewButton).toBeInTheDocument();
    expect(codeButton).toBeInTheDocument();
  });

  it('toggles view mode when preview/code buttons are clicked', () => {
    render(<ArtifactContent artifact={mockArtifact} />);
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

  it('does not render preview/code buttons when preview of artifact file extension is unsupported', () => {
    const unsupportedArtifact: Artifact = {
      ...mockArtifact,
      fileExtension: '.js',
    };

    render(<ArtifactContent artifact={unsupportedArtifact} />);

    const previewButton = screen.queryByTestId('toggle-artifact-view-preview');
    const codeButton = screen.queryByTestId('toggle-artifact-view-code');
    
    expect(previewButton).not.toBeInTheDocument();
    expect(codeButton).not.toBeInTheDocument();
  });

  it('records opening the artifacts list as a panel toggle', () => {
    render(<ArtifactContent artifact={mockArtifact} />);

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

    render(<ArtifactContent artifact={publishedArtifact} />);

    fireEvent.click(screen.getByLabelText('View on GitHub Pages'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.ExternalNavigation,
      label: 'View on GitHub Pages',
      href: 'https://myorg.github.io/my-repo/artifact.html',
    });
  });
});
