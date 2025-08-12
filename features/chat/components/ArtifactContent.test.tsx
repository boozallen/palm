import { render, screen, fireEvent } from '@testing-library/react';
import ArtifactContent from './ArtifactContent';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { Artifact } from '@/features/chat/types/message';
import { downloadArtifact } from '@/features/chat/utils/artifactHelperFunctions';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

jest.mock('@/features/chat/utils/artifactHelperFunctions');

describe('ArtifactContent', () => {
  const mockArtifact: Artifact = {
    id: '1',
    fileExtension: '.md',
    label: 'Test Artifact',
    content: 'This is a test artifact content.',
    chatMessageId: '123',
    createdAt: new Date(),
  };

  const mockSetSelectedArtifact = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useChat as jest.Mock).mockReturnValue({
      setSelectedArtifact: mockSetSelectedArtifact,
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
});
