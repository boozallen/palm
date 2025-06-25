import { render, screen, waitFor } from '@testing-library/react';
import Citations from './Citations';
import userEvent from '@testing-library/user-event';

describe('Citations', () => {

  const longCitationText = 'Some dummy paragraph that fills the place of the chunk returned by ' +
    'the knowledge base as being relevant. This text is intended to mimic the length and ' +
    'structure of a real citation, providing a placeholder for testing purposes. The content ' +
    'here is purely fictional and serves as an example of how a citation might appear in a ' +
    'document or database. It continues with more placeholder text to ensure that the length is ' +
    'sufficient for testing, including various sentence structures and vocabulary to simulate a ' +
    'realistic excerpt from a document. This ensures that all necessary elements are covered ' +
    'comprehensively.';

  const mockCitations = [
    {
      knowledgeBaseLabel: 'Quantum Mechanics',
      citation: `(Schrödinger\'s Cat, p. 10): ${longCitationText}`,
    },
    {
      knowledgeBaseLabel: 'Artificial Intelligence',
      citation: `(Turing Test, p. 3): ${longCitationText}`,
    },
    { knowledgeBaseLabel: 'Literature', citation: 'Shakespeare\'s Sonnets' },
    { knowledgeBaseLabel: 'Computer Science', citation: 'Algorithm Analysis' },
    { knowledgeBaseLabel: 'Biology', citation: `(DNA Sequencing, p. 132): ${longCitationText}` },
  ];

  it('renders the correct number of displayed citations', () => {
    render(<Citations citations={mockCitations} />);

    const displayedAvatars = [
      screen.getByTestId('displayed-avatar-0'),
      screen.getByTestId('displayed-avatar-1'),
      screen.getByTestId('displayed-avatar-2'),
    ];
    const remainingCitationsAvatar = screen.getByTestId('remaining-citations-avatar');

    expect(displayedAvatars).toHaveLength(3);
    expect(remainingCitationsAvatar).toBeInTheDocument();
  });

  it('renders the remaining citations count correctly', () => {
    render(<Citations citations={mockCitations} />);

    const remainingCitationsAvatar = screen.getByText('+2');
    expect(remainingCitationsAvatar).toBeInTheDocument();
  });

  it('does not render the remaining citations avatar if there are no remaining citations', () => {
    const mockCitation = [
      { knowledgeBaseLabel: 'Astronomy', citation: 'Hubble\'s Law' },
    ];
    render(<Citations citations={mockCitation} />);

    const displayedAvatars = [
      screen.getByTestId('displayed-avatar-0'),
    ];
    const remainingCitationsAvatar = screen.queryByTestId('remaining-citations-avatar');

    expect(displayedAvatars).toHaveLength(1);
    expect(remainingCitationsAvatar).not.toBeInTheDocument();
  });

  it('renders the correct hovercard content for displayed citations', async () => {
    render(<Citations citations={mockCitations} />);

    for (let i = 0; i < 3; i++) {
      const avatar = screen.getByTestId(`displayed-avatar-${i}`);
      await userEvent.hover(avatar);

      await waitFor(() => {
        const knowledgeBaseLabel = screen.getByText(mockCitations[i].knowledgeBaseLabel);
        expect(knowledgeBaseLabel).toBeInTheDocument();
        const citation = screen.getByText(mockCitations[i].citation);
        expect(citation).toBeInTheDocument();
      });
    }
  });

  it('renders the correct hovercard content for remaining citations', async () => {
    render(<Citations citations={mockCitations} />);

    const remainingAvatar = screen.getByTestId('remaining-citations-avatar');
    await userEvent.hover(remainingAvatar);

    await waitFor(() => {
      const citationOne = screen.getByText(mockCitations[3].citation);
      expect(citationOne).toBeInTheDocument();
      const knowledgeBaseLabelOne = screen.getByText(mockCitations[3].knowledgeBaseLabel);
      expect(knowledgeBaseLabelOne).toBeInTheDocument();
      const citationTwo = screen.getByText(mockCitations[4].citation);
      expect(citationTwo).toBeInTheDocument();
      const knowledgeBaseLabelTwo = screen.getByText(mockCitations[4].knowledgeBaseLabel);
      expect(knowledgeBaseLabelTwo).toBeInTheDocument();
    });
  });
});
