import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArtifactButton from './ArtifactButton';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { Artifact } from '@/features/chat/types/message';
import { downloadArtifact } from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import { AuditRecordEvent, AuditRecordResourceType } from '@/features/shared/types/audit-record';

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

// Only downloadArtifact is stubbed — isServerDownloadedArtifact stays real
// because whether the download was already audited server-side is what these
// tests assert on.
jest.mock('@/features/chat/utils/artifacts/artifactHelperFunctions', () => ({
  ...jest.requireActual('@/features/chat/utils/artifacts/artifactHelperFunctions'),
  downloadArtifact: jest.fn(),
}));

const mockCreateAuditRecord = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: () => ({ mutate: mockCreateAuditRecord }),
}));

describe('ArtifactButton', () => {
  // Audit metadata only keeps ids the server can validate as uuids, so the
  // fixtures have to look like real records.
  const mockChatId = 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6';

  const mockArtifact: Artifact = {
    id: '0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62',
    fileExtension: '.txt',
    label: 'Sample Text File',
    content: 'This is a sample text file content.',
    chatMessageId: 'ce1f6a2f-9f5f-4d4e-8f9a-5d3ba2a35f2b',
    githubPagesUrl: null,
    githubUrl: null,
    createdAt: new Date(),
  };

  const mockWindowOpen = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.open = mockWindowOpen;
  });

  it('renders the correct icon and label for a plain text file', () => {
    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact: jest.fn(),
      chatId: mockChatId,
    });

    render(<ArtifactButton artifact={mockArtifact} />);

    expect(screen.getByTestId('artifact-icon-document')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-title')).toHaveTextContent('Sample Text File');
    expect(screen.getByTestId('artifact-description')).toHaveTextContent('Document • TXT');
  });

  it('renders the correct icon and label for a code file', () => {
    const codeArtifact = { ...mockArtifact, fileExtension: '.js', label: 'Sample Code File' };

    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact: jest.fn(),
      chatId: mockChatId,
    });

    render(<ArtifactButton artifact={codeArtifact} />);

    expect(screen.getByTestId('artifact-icon-code')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-title')).toHaveTextContent('Sample Code File');
    expect(screen.getByTestId('artifact-description')).toHaveTextContent('Code • JS');
  });

  it('renders the correct icon and label for a video file', () => {
    const videoArtifact = { ...mockArtifact, fileExtension: '.mp4', label: 'Sample Video' };

    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact: jest.fn(),
      chatId: mockChatId,
    });

    render(<ArtifactButton artifact={videoArtifact} />);

    expect(screen.getByTestId('artifact-icon-video-file')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-title')).toHaveTextContent('Sample Video');
    expect(screen.getByTestId('artifact-description')).toHaveTextContent('Video file • MP4');
  });

  it('renders the correct icon and label for an audio file', () => {
    const audioArtifact = { ...mockArtifact, fileExtension: '.mp3', label: 'Sample Audio' };

    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact: jest.fn(),
      chatId: mockChatId,
    });

    render(<ArtifactButton artifact={audioArtifact} />);

    expect(screen.getByTestId('artifact-icon-audio-file')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-title')).toHaveTextContent('Sample Audio');
    expect(screen.getByTestId('artifact-description')).toHaveTextContent('Audio file • MP3');
  });

  it('renders binary file with correct description', () => {
    const binaryArtifact: Artifact = {
      ...mockArtifact,
      fileExtension: '.pdf',
      content: '',
      label: 'Sample PDF',
    };

    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact: jest.fn(),
      chatId: mockChatId,
    });

    render(<ArtifactButton artifact={binaryArtifact} />);

    expect(screen.getByTestId('artifact-title')).toHaveTextContent('Sample PDF');
    expect(screen.getByTestId('artifact-description')).toHaveTextContent('Document • PDF');
  });

  it('selects the artifact when clicked', async () => {
    const setSelectedArtifact = jest.fn();
    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact,
      chatId: mockChatId,
    });

    render(<ArtifactButton artifact={mockArtifact} />);

    const button = screen.getByTestId('artifact-button');
    await userEvent.click(button);

    expect(setSelectedArtifact).toHaveBeenCalledWith(mockArtifact);
  });

  it('downloads binary file when clicked instead of opening artifact panel', async () => {
    const binaryArtifact: Artifact = {
      ...mockArtifact,
      fileExtension: '.pdf',
      content: '',
      label: 'Sample PDF',
    };

    const setSelectedArtifact = jest.fn();
    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact,
      chatId: mockChatId,
    });

    render(<ArtifactButton artifact={binaryArtifact} />);

    const downloadButton = screen.getByTestId('artifact-download-button');
    await userEvent.click(downloadButton);

    expect(downloadArtifact).toHaveBeenCalledWith(binaryArtifact);
    expect(setSelectedArtifact).not.toHaveBeenCalled();
    // Downloads served by /api/chat/artifacts/download are audited server-side,
    // so the client must not record a duplicate.
    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('records a download audit record for client-generated (non-server) downloads', async () => {
    // A .docx artifact with inline content is converted in the browser rather
    // than fetched from the audited API route, so the client records it.
    const clientGeneratedArtifact: Artifact = {
      ...mockArtifact,
      fileExtension: '.docx',
      content: 'Some markdown content',
      label: 'Word Document',
    };

    const setSelectedArtifact = jest.fn();
    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact,
      chatId: mockChatId,
    });

    render(<ArtifactButton artifact={clientGeneratedArtifact} />);

    const downloadButton = screen.getByTestId('artifact-download-button');
    await userEvent.click(downloadButton);

    expect(downloadArtifact).toHaveBeenCalledWith(clientGeneratedArtifact);
    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.DownloadArtifact,
      label: 'chat artifact "Word Document.docx"',
      metadata: {
        resourceType: AuditRecordResourceType.ChatArtifact,
        resourceIds: [clientGeneratedArtifact.id],
        filenames: ['Word Document.docx'],
        chatId: mockChatId,
      },
    });
  });

  it('opens artifact panel for binary file with content', async () => {
    const binaryArtifactWithContent: Artifact = {
      ...mockArtifact,
      fileExtension: '.docx',
      content: 'Some markdown content',
      label: 'Word Document',
    };

    const setSelectedArtifact = jest.fn();
    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact,
      chatId: mockChatId,
    });

    render(<ArtifactButton artifact={binaryArtifactWithContent} />);

    const button = screen.getByTestId('artifact-button');
    await userEvent.click(button);

    expect(setSelectedArtifact).toHaveBeenCalledWith(binaryArtifactWithContent);
    expect(downloadArtifact).not.toHaveBeenCalled();
  });
});
