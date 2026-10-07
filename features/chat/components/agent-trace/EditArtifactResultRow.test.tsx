import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';

import EditArtifactResultRow from './EditArtifactResultRow';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { Artifact } from '@/features/chat/types/message';

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider withGlobalStyles withNormalizeCSS>
      {component}
    </MantineProvider>
  );
};

const mockArtifact: Artifact = {
  id: '0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62',
  fileExtension: '.pptx',
  label: 'History of Booz Allen Hamilton',
  content: '',
  chatMessageId: 'ce1f6a2f-9f5f-4d4e-8f9a-5d3ba2a35f2b',
  githubPagesUrl: null,
  githubUrl: null,
  createdAt: new Date(),
};

describe('EditArtifactResultRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the added and removed diff badges', () => {
    (useChat as jest.Mock).mockReturnValue({ setSelectedArtifact: jest.fn() });

    renderWithMantine(
      <EditArtifactResultRow
        results={[{ title: 'History of Booz Allen Hamilton.pptx', artifact: mockArtifact }]}
        diffStat={{ added: 3, removed: 1 }}
      />
    );

    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  it('hides a badge whose count is zero', () => {
    (useChat as jest.Mock).mockReturnValue({ setSelectedArtifact: jest.fn() });

    renderWithMantine(
      <EditArtifactResultRow
        results={[{ title: 'History of Booz Allen Hamilton.pptx', artifact: mockArtifact }]}
        diffStat={{ added: 2, removed: 0 }}
      />
    );

    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByText('-0')).not.toBeInTheDocument();
  });

  it('opens the artifact viewer when the filename is clicked', async () => {
    const setSelectedArtifact = jest.fn();
    (useChat as jest.Mock).mockReturnValue({ setSelectedArtifact });

    renderWithMantine(
      <EditArtifactResultRow
        results={[{ title: 'History of Booz Allen Hamilton.pptx', artifact: mockArtifact }]}
        diffStat={{ added: 1, removed: 1 }}
      />
    );

    await userEvent.click(screen.getByTestId('artifact-filename'));

    expect(setSelectedArtifact).toHaveBeenCalledWith(mockArtifact);
  });

  it('does not attempt to open an artifact when none is attached to the result', async () => {
    const setSelectedArtifact = jest.fn();
    (useChat as jest.Mock).mockReturnValue({ setSelectedArtifact });

    renderWithMantine(
      <EditArtifactResultRow
        results={[{ title: 'History of Booz Allen Hamilton.pptx' }]}
        diffStat={{ added: 1, removed: 1 }}
      />
    );

    await userEvent.click(screen.getByTestId('artifact-filename'));

    expect(setSelectedArtifact).not.toHaveBeenCalled();
  });
});
