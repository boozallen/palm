import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import UseCaseArtifactList from './UseCaseArtifactList';
import { UseCaseArtifactRow } from '@/features/context-studio/types/use-case-detail';

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<MantineProvider>{ui}</MantineProvider>);
};

describe('UseCaseArtifactList', () => {
  const mockArtifacts: UseCaseArtifactRow[] = [
    {
      artifactId: 'artifact-1',
      name: 'Design Document',
      chatId: 'chat-1',
      signals: ['downloaded', 'copied'],
    },
    {
      artifactId: 'artifact-2',
      name: 'Code Snippet',
      chatId: 'chat-2',
      signals: ['published'],
    },
  ];

  it('names each work product', () => {
    renderWithTheme(<UseCaseArtifactList artifacts={mockArtifacts} />);
    const artifactRows = screen.getAllByTestId('use-case-artifact-row');
    expect(artifactRows.length).toBe(2);
    expect(screen.getByText('Design Document')).toBeInTheDocument();
    expect(screen.getByText('Code Snippet')).toBeInTheDocument();
  });

  it('names which signals fired for a work product that was put to work', () => {
    renderWithTheme(<UseCaseArtifactList artifacts={mockArtifacts} />);
    expect(screen.getByText(/downloaded/)).toBeInTheDocument();
    expect(screen.getByText(/copied/)).toBeInTheDocument();
    expect(screen.getByText(/published/)).toBeInTheDocument();
  });

  it('marks a work product that was never used', () => {
    const unusedArtifacts: UseCaseArtifactRow[] = [
      {
        artifactId: 'artifact-1',
        name: 'Unused Document',
        chatId: 'chat-1',
        signals: [],
      },
    ];
    renderWithTheme(<UseCaseArtifactList artifacts={unusedArtifacts} />);
    const unusedElement = screen.getByTestId('use-case-artifact-unused');
    expect(unusedElement).toBeInTheDocument();
    expect(screen.getByText('not used')).toBeInTheDocument();
  });

  it('renders a dash when the category produced nothing', () => {
    renderWithTheme(<UseCaseArtifactList artifacts={[]} />);
    const emptyElement = screen.getByTestId('use-case-artifacts-empty');
    expect(emptyElement).toBeInTheDocument();
  });
});
