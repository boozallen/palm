import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ArtifactsContainer from './ArtifactsContainer';
import { Artifact } from '@/features/chat/types/message';
import { AuditRecordEvent, AuditRecordResourceType } from '@/features/shared/types/audit-record';

// Audit metadata only keeps ids the server can validate as uuids, so the
// fixtures have to look like real records.
const MOCK_CHAT_ID = 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6';
const MOCK_MESSAGE_ID = 'ce1f6a2f-9f5f-4d4e-8f9a-5d3ba2a35f2b';
const MOCK_SECOND_MESSAGE_ID = 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6';

const mockArtifacts: Artifact[] = [
  {
    id: '0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62',
    label: 'Test HTML File',
    content: '<html><body>Hello</body></html>',
    fileExtension: '.html',
    chatMessageId: MOCK_MESSAGE_ID,
    githubPagesUrl: null,
    createdAt: new Date('2026-05-27T10:00:00Z'),
  },
  {
    id: '9c1a0d5b-2a54-4e2f-8f1a-91f0a17b6b28',
    label: 'Test Python Script',
    content: 'print("hello")',
    fileExtension: '.py',
    chatMessageId: MOCK_MESSAGE_ID,
    githubPagesUrl: null,
    createdAt: new Date('2026-05-27T10:00:00Z'),
  },
  {
    id: 'd4c3b8f1-0f6e-4a1b-9c2d-7e8f5a6b3c1d',
    label: 'Test Video',
    content: '{}',
    fileExtension: '.mp4',
    chatMessageId: MOCK_SECOND_MESSAGE_ID,
    githubPagesUrl: null,
    createdAt: new Date('2026-05-27T10:00:00Z'),
  },
];

const mockSetSelectedArtifact = jest.fn();
const mockSetShowArtifactsContainer = jest.fn();
const mockCreateAuditRecord = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: () => ({ mutate: mockCreateAuditRecord }),
}));

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  ...jest.requireActual('@/features/chat/providers/ChatProvider'),
  useChat: () => ({
    setSelectedArtifact: mockSetSelectedArtifact,
    setShowArtifactsContainer: mockSetShowArtifactsContainer,
    chatId: MOCK_CHAT_ID,
  }),
}));

describe('ArtifactsContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders list of artifacts', () => {
    render(<ArtifactsContainer artifacts={mockArtifacts} />);

    expect(screen.getByText('Artifacts (3)')).toBeInTheDocument();
    expect(screen.getByText('Test HTML File')).toBeInTheDocument();
    expect(screen.getByText('Test Python Script')).toBeInTheDocument();
    expect(screen.getByText('Test Video')).toBeInTheDocument();
  });

  it('calls setShowArtifactsContainer(false) when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<ArtifactsContainer artifacts={mockArtifacts} />);

    const closeButton = screen.getByLabelText('Close artifacts list');
    await user.click(closeButton);

    expect(mockSetShowArtifactsContainer).toHaveBeenCalledWith(false);
  });

  it('records closing the artifacts list as a panel toggle', async () => {
    const user = userEvent.setup();
    render(<ArtifactsContainer artifacts={mockArtifacts} />);

    await user.click(screen.getByLabelText('Close artifacts list'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.TogglePanel,
      label: 'Close artifacts list',
    });
  });

  it('calls setSelectedArtifact and setShowArtifactsContainer when artifact is clicked', async () => {
    const user = userEvent.setup();
    render(<ArtifactsContainer artifacts={mockArtifacts} />);

    const artifactButton = screen.getByTestId(`artifact-list-item-${mockArtifacts[0].id}`);
    await user.click(artifactButton);

    expect(mockSetSelectedArtifact).toHaveBeenCalledWith(mockArtifacts[0]);
    expect(mockSetShowArtifactsContainer).toHaveBeenCalledWith(false);
  });

  it('shows correct description for different file types', () => {
    render(<ArtifactsContainer artifacts={mockArtifacts} />);

    expect(screen.getByText('Code - HTML')).toBeInTheDocument();
    expect(screen.getByText('Code - PY')).toBeInTheDocument();
    expect(screen.getByText('Video - MP4')).toBeInTheDocument();
  });

  it('renders empty list when no artifacts', () => {
    render(<ArtifactsContainer artifacts={[]} />);

    expect(screen.getByText('Artifacts (0)')).toBeInTheDocument();
  });

  it('downloads artifact when download button is clicked', async () => {
    const user = userEvent.setup();

    render(<ArtifactsContainer artifacts={mockArtifacts} />);

    const createObjectURLMock = jest.fn(() => 'blob:mock-url');
    const revokeObjectURLMock = jest.fn();
    const mockClick = jest.fn();

    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    const mockAnchor = {
      click: mockClick,
      href: '',
      download: '',
    } as unknown as HTMLAnchorElement;

    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
    const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

    const downloadButton = screen.getByTestId(`artifact-download-${mockArtifacts[0].id}`);
    await user.click(downloadButton);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor);
    expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    expect(mockSetSelectedArtifact).not.toHaveBeenCalled();
    expect(mockSetShowArtifactsContainer).not.toHaveBeenCalled();
    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.DownloadArtifact,
      label: 'chat artifact "Test HTML File.html"',
      metadata: {
        resourceType: AuditRecordResourceType.ChatArtifact,
        resourceIds: [mockArtifacts[0].id],
        filenames: ['Test HTML File.html'],
        chatId: MOCK_CHAT_ID,
      },
    });

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('downloads all artifacts when download all button is clicked', async () => {
    const user = userEvent.setup();

    render(<ArtifactsContainer artifacts={mockArtifacts} />);

    const createObjectURLMock = jest.fn(() => 'blob:mock-url');
    const revokeObjectURLMock = jest.fn();
    const mockClick = jest.fn();

    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    const mockAnchor = {
      click: mockClick,
      href: '',
      download: '',
    } as unknown as HTMLAnchorElement;

    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
    const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

    const downloadAllButton = screen.getByText('Download all');
    await user.click(downloadAllButton);

    expect(createObjectURLMock).toHaveBeenCalledTimes(3);
    expect(mockClick).toHaveBeenCalledTimes(3);
    expect(appendChildSpy).toHaveBeenCalledTimes(3);
    expect(removeChildSpy).toHaveBeenCalledTimes(3);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(3);
    // One record for the bulk action, but it has to name every file that left.
    expect(mockCreateAuditRecord).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.DownloadArtifact,
      label: 'all 3 chat artifacts',
      metadata: {
        resourceType: AuditRecordResourceType.ChatArtifact,
        resourceIds: mockArtifacts.map((artifact) => artifact.id),
        filenames: ['Test HTML File.html', 'Test Python Script.py', 'Test Video.mp4'],
        chatId: MOCK_CHAT_ID,
      },
    });

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('disables download all button when no artifacts', () => {
    render(<ArtifactsContainer artifacts={[]} />);

    const downloadAllButton = screen.getByRole('button', { name: /download all/i });
    expect(downloadAllButton).toBeDisabled();
  });
});
