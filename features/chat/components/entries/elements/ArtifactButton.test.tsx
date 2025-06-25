import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArtifactButton from './ArtifactButton';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { Artifact } from '@/features/chat/types/message';

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

describe('ArtifactButton', () => {
  const mockArtifact: Artifact = {
    id: 'artifact-1',
    fileExtension: '.txt',
    label: 'Sample Text File',
    content: 'This is a sample text file content.',
    chatMessageId: 'message-1',
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the correct icon and label for a plain text file', () => {
    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact: jest.fn(),
    });

    render(<ArtifactButton artifact={mockArtifact} />);

    expect(screen.getByTestId('artifact-icon-document')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-title')).toHaveTextContent('Sample Text File');
    expect(screen.getByTestId('artifact-description')).toHaveTextContent('Click to open document');
  });

  it('renders the correct icon and label for a code file', () => {
    const codeArtifact = { ...mockArtifact, fileExtension: '.js', label: 'Sample Code File' };

    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact: jest.fn(),
    });

    render(<ArtifactButton artifact={codeArtifact} />);

    expect(screen.getByTestId('artifact-icon-code')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-title')).toHaveTextContent('Sample Code File');
    expect(screen.getByTestId('artifact-description')).toHaveTextContent('Click to open code');
  });

  it('selects the artifact when no artifact is selected', async () => {
    const setSelectedArtifact = jest.fn();
    (useChat as jest.Mock).mockReturnValue({
      selectedArtifact: null,
      setSelectedArtifact,
    });

    render(<ArtifactButton artifact={mockArtifact} />);

    const button = screen.getByTestId('artifact-button');
    await userEvent.click(button);

    expect(setSelectedArtifact).toHaveBeenCalledWith(mockArtifact);
  });
});
