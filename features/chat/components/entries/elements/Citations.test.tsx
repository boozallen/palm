import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Citations from './Citations';
import { ContextType, Citation } from '@/features/chat/types/message';
import { ChatProvider } from '@/features/chat/providers/ChatProvider';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: {},
  }),
}));

jest.mock('@/features/shared/api/get-system-config', () => ({
  useGetSystemConfig: () => ({
    data: {
      documentLibraryDocumentUploadProviderId: 'test-provider-id',
    },
  }),
}));

jest.mock('@/features/shared/api/document-upload/get-documents', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: {
      documents: [
        {
          id: 'doc-1',
          userId: 'user-1',
          filename: 'document-with-text.pdf',
          uploadStatus: DocumentUploadStatus.Completed,
          createdAt: new Date(),
          text: 'This is the full text content of the document',
        },
        {
          id: 'doc-2',
          userId: 'user-1',
          filename: 'document-without-text.pdf',
          uploadStatus: DocumentUploadStatus.Completed,
          createdAt: new Date(),
          text: undefined,
        },
      ],
    },
  })),
}));

jest.mock('@/features/shared/api/get-user-graph-database-access', () => ({
  useGetUserGraphDatabaseAccess: () => ({
    data: {
      hasAccess: false,
    },
  }),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChatProvider>{children}</ChatProvider>
);

describe('Citations', () => {

  const longCitationText = 'Some dummy paragraph that fills the place of the chunk returned by ' +
    'the knowledge base as being relevant. This text is intended to mimic the length and ' +
    'structure of a real citation, providing a placeholder for testing purposes. The content ' +
    'here is purely fictional and serves as an example of how a citation might appear in a ' +
    'document or database. It continues with more placeholder text to ensure that the length is ' +
    'sufficient for testing, including various sentence structures and vocabulary to simulate a ' +
    'realistic excerpt from a document. This ensures that all necessary elements are covered ' +
    'comprehensively.';

  const mockCitations: Citation[] = [
    {
      contextType: ContextType.KNOWLEDGE_BASE,
      knowledgeBaseId: 'kb-1',
      sourceLabel: 'Quantum Mechanics',
      citation: `(Schrödinger\'s Cat, p. 10): ${longCitationText}`,
    },
    {
      contextType: ContextType.KNOWLEDGE_BASE,
      knowledgeBaseId: 'kb-2',
      sourceLabel: 'Artificial Intelligence',
      citation: `(Turing Test, p. 3): ${longCitationText}`,
    },
    {
      contextType: ContextType.KNOWLEDGE_BASE,
      knowledgeBaseId: 'kb-3',
      sourceLabel: 'Literature',
      citation: 'Shakespeare\'s Sonnets',
    },
    {
      contextType: ContextType.KNOWLEDGE_BASE,
      knowledgeBaseId: 'kb-4',
      sourceLabel: 'Computer Science',
      citation: 'Algorithm Analysis',
    },
    {
      contextType: ContextType.KNOWLEDGE_BASE,
      knowledgeBaseId: 'kb-5',
      sourceLabel: 'Biology',
      citation: `(DNA Sequencing, p. 132): ${longCitationText}`,
    },
  ];

  it('renders the correct number of displayed citations', () => {
    render(<Citations citations={mockCitations} />, { wrapper: Wrapper });

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
    render(<Citations citations={mockCitations} />, { wrapper: Wrapper });

    const remainingCitationsAvatar = screen.getByText('+2');
    expect(remainingCitationsAvatar).toBeInTheDocument();
  });

  it('does not render the remaining citations avatar if there are no remaining citations', () => {
    const mockCitation: Citation[] = [
      {
        contextType: ContextType.KNOWLEDGE_BASE,
        knowledgeBaseId: 'kb-6',
        sourceLabel: 'Astronomy',
        citation: 'Hubble\'s Law',
      },
    ];
    render(<Citations citations={mockCitation} />, { wrapper: Wrapper });

    const displayedAvatars = [
      screen.getByTestId('displayed-avatar-0'),
    ];
    const remainingCitationsAvatar = screen.queryByTestId('remaining-citations-avatar');

    expect(displayedAvatars).toHaveLength(1);
    expect(remainingCitationsAvatar).not.toBeInTheDocument();
  });

  it('renders the correct hovercard content for displayed citations', async () => {
    render(<Citations citations={mockCitations} />, { wrapper: Wrapper });

    for (let i = 0; i < 3; i++) {
      const avatar = screen.getByTestId(`displayed-avatar-${i}`);
      await userEvent.hover(avatar);

      await waitFor(() => {
        const sourceLabel = screen.getByText(mockCitations[i].sourceLabel);
        expect(sourceLabel).toBeInTheDocument();
        const citation = screen.getByText(mockCitations[i].citation);
        expect(citation).toBeInTheDocument();
      });
    }
  });

  it('renders the correct hovercard content for remaining citations', async () => {
    render(<Citations citations={mockCitations} />, { wrapper: Wrapper });

    const remainingAvatar = screen.getByTestId('remaining-citations-avatar');
    await userEvent.hover(remainingAvatar);

    await waitFor(() => {
      const citationOne = screen.getByText(mockCitations[3].citation);
      expect(citationOne).toBeInTheDocument();
      const sourceLabelOne = screen.getByText(mockCitations[3].sourceLabel);
      expect(sourceLabelOne).toBeInTheDocument();
      const citationTwo = screen.getByText(mockCitations[4].citation);
      expect(citationTwo).toBeInTheDocument();
      const sourceLabelTwo = screen.getByText(mockCitations[4].sourceLabel);
      expect(sourceLabelTwo).toBeInTheDocument();
    });
  });

  it('shows View Source button for document citations with text', async () => {
    const citationWithText: Citation[] = [
      {
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: 'doc-1',
        sourceLabel: 'Document with Text',
        citation: 'This is a citation from a document with text',
      },
    ];

    render(<Citations citations={citationWithText} />, { wrapper: Wrapper });

    const avatar = screen.getByTestId('displayed-avatar-0');
    await userEvent.hover(avatar);

    await waitFor(() => {
      const viewButton = screen.getByText('View Source');
      expect(viewButton).toBeInTheDocument();
    });
  });

  it('hides View Source button for document citations without text', async () => {
    const citationWithoutText: Citation[] = [
      {
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: 'doc-2',
        sourceLabel: 'Document without Text',
        citation: 'This is a citation from a document without text',
      },
    ];

    render(<Citations citations={citationWithoutText} />, { wrapper: Wrapper });

    const avatar = screen.getByTestId('displayed-avatar-0');
    await userEvent.hover(avatar);

    await waitFor(() => {
      const viewButton = screen.queryByText('View Source');
      expect(viewButton).not.toBeInTheDocument();
    });
  });

  it('hides View Source button for knowledge base citations', async () => {
    const kbCitation: Citation[] = [
      {
        contextType: ContextType.KNOWLEDGE_BASE,
        knowledgeBaseId: 'kb-1',
        sourceLabel: 'Knowledge Base',
        citation: 'This is a knowledge base citation',
      },
    ];

    render(<Citations citations={kbCitation} />, { wrapper: Wrapper });

    const avatar = screen.getByTestId('displayed-avatar-0');
    await userEvent.hover(avatar);

    await waitFor(() => {
      const viewButton = screen.queryByText('View Source');
      expect(viewButton).not.toBeInTheDocument();
    });
  });
});
