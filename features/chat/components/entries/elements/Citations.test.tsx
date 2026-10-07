import { render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import userEvent from '@testing-library/user-event';

import Citations from './Citations';
import { ContextType, Citation } from '@/features/chat/types/message';
import { ChatProvider } from '@/features/chat/providers/ChatProvider';
import { DocumentUploadStatus } from '@/features/shared/types/document';

const mockRouterPush = jest.fn();
const mockDownloadArtifact = jest.fn();
const mockFetchCitedArtifact = jest.fn();
const mockSetHighlightedCitation = jest.fn();
const mockSetSelectedArtifact = jest.fn();
const mockSetShowArtifactsContainer = jest.fn();
const mockSetSourcesSidebarExpanded = jest.fn();
let mockChatId: string | null = null;

jest.mock('@/features/chat/providers/ChatProvider', () => {
  const actual = jest.requireActual('@/features/chat/providers/ChatProvider');
  return {
    ...actual,
    useChat: () => ({
      chatId: mockChatId,
      setHighlightedCitation: mockSetHighlightedCitation,
      setSelectedArtifact: mockSetSelectedArtifact,
      setShowArtifactsContainer: mockSetShowArtifactsContainer,
      setSourcesSidebarExpanded: mockSetSourcesSidebarExpanded,
    }),
  };
});

jest.mock('@/features/chat/api/get-cited-artifact', () => ({
  __esModule: true,
  default: () => ({ fetch: mockFetchCitedArtifact }),
}));

jest.mock('@/features/chat/utils/artifacts/artifactHelperFunctions', () => {
  const actual = jest.requireActual('@/features/chat/utils/artifacts/artifactHelperFunctions');
  return {
    ...actual,
    downloadArtifact: (...args: unknown[]) => mockDownloadArtifact(...args),
  };
});

jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: {},
    push: mockRouterPush,
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
      // The real list query omits `.text` (fetched lazily when a document is
      // opened), so these fixtures intentionally carry no `text` field.
      documents: [
        {
          id: 'doc-1',
          userId: 'user-1',
          filename: 'document.pdf',
          uploadStatus: DocumentUploadStatus.Completed,
          createdAt: new Date(),
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

  const fetchedArtifact = {
    id: 'artifact-1',
    label: 'Decision log',
    fileExtension: '.docx',
    content: 'Artifact content',
    sourceScript: null,
    githubUrl: null,
    githubPagesUrl: null,
    createdAt: new Date('2026-08-09T12:00:00.000Z'),
    chatMessageId: 'message-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockChatId = null;
    mockFetchCitedArtifact.mockResolvedValue(fetchedArtifact);
  });

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

  it('shows View Source button for document citations whose document exists in the library', async () => {
    const citationWithDocument: Citation[] = [
      {
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: 'doc-1',
        sourceLabel: 'Document',
        citation: 'This is a citation from a known document',
      },
    ];

    render(<Citations citations={citationWithDocument} />, { wrapper: Wrapper });

    const avatar = screen.getByTestId('displayed-avatar-0');
    await userEvent.hover(avatar);

    await waitFor(() => {
      const viewButton = screen.getByText('View Source');
      expect(viewButton).toBeInTheDocument();
    });
  });

  it('hides View Source button when the cited document is no longer in the library', async () => {
    const citationWithMissingDocument: Citation[] = [
      {
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: 'doc-missing',
        sourceLabel: 'Deleted Document',
        citation: 'This is a citation from a document that no longer exists',
      },
    ];

    render(<Citations citations={citationWithMissingDocument} />, { wrapper: Wrapper });

    const avatar = screen.getByTestId('displayed-avatar-0');
    await userEvent.hover(avatar);

    await waitFor(() => {
      const viewButton = screen.queryByText('View Source');
      expect(viewButton).not.toBeInTheDocument();
    });
  });

  it('renders section and page metadata above a document citation', async () => {
    const citationWithMetadata: Citation[] = [
      {
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: 'doc-1',
        sourceLabel: 'Document with metadata',
        citation: 'Cited text',
        sectionPath: ['Overview', 'Findings'],
        pageStart: 3,
        pageEnd: 5,
      },
    ];

    render(<Citations citations={citationWithMetadata} />, { wrapper: Wrapper });
    await userEvent.hover(screen.getByTestId('displayed-avatar-0'));

    expect(await screen.findByTestId('citation-metadata')).toHaveTextContent(
      'Overview > Findings · pp. 3-5',
    );
  });

  it('does not render a metadata line when section and pages are absent', async () => {
    const citationWithoutMetadata: Citation[] = [
      {
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: 'doc-1',
        sourceLabel: 'Document without metadata',
        citation: 'Cited text',
      },
    ];

    render(<Citations citations={citationWithoutMetadata} />, { wrapper: Wrapper });
    await userEvent.hover(screen.getByTestId('displayed-avatar-0'));
    await screen.findByText('Cited text');

    expect(screen.queryByTestId('citation-metadata')).not.toBeInTheDocument();
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

  it('renders and opens a distinct prior-conversation citation', async () => {
    const artifactCreatedAt = '2026-08-09T12:00:00.000Z';
    const priorCitation: Citation[] = [{
      contextType: ContextType.PRIOR_CONVERSATION,
      citedMessageId: 'message-1',
      chatId: 'source-chat-1',
      role: 'assistant',
      messageCreatedAt: '2026-08-10T12:00:00.000Z',
      artifacts: [{
        id: 'artifact-1',
        label: 'Decision log',
        fileExtension: '.docx',
        createdAt: artifactCreatedAt,
      }],
      sourceLabel: 'Architecture decisions',
      citation: 'We chose pgvector.',
    }];
    render(<Citations citations={priorCitation} />, { wrapper: Wrapper });

    const avatar = screen.getByTestId('displayed-avatar-0');
    expect(avatar.querySelector('.tabler-icon-message-circle')).toBeInTheDocument();
    await userEvent.hover(avatar);

    expect(await screen.findByText('Architecture decisions')).toBeInTheDocument();
    expect(screen.getByText(/From a prior conversation/)).toBeInTheDocument();
    expect(screen.getByText('We chose pgvector.')).toBeInTheDocument();
    const artifactBadge = screen.getByTestId('citation-artifact-artifact-1');
    expect(artifactBadge).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open conversation' })).toBeInTheDocument();

    await userEvent.click(artifactBadge);
    await waitFor(() => {
      expect(mockFetchCitedArtifact).toHaveBeenCalledWith({ artifactId: 'artifact-1' });
      expect(mockSetSelectedArtifact).toHaveBeenCalledWith({
        ...fetchedArtifact,
        isExternal: true,
      });
    });
    expect(mockSetShowArtifactsContainer).toHaveBeenCalledWith(false);
    expect(mockRouterPush).not.toHaveBeenCalled();

    await userEvent.click(avatar);
    expect(mockRouterPush).toHaveBeenCalledWith('/chat/source-chat-1?cited_message_id=message-1');
  });

  it('shows a notification when a cited artifact cannot be fetched', async () => {
    mockFetchCitedArtifact.mockRejectedValue(new Error('private request details'));
    const priorCitation: Citation[] = [{
      contextType: ContextType.PRIOR_CONVERSATION,
      citedMessageId: 'message-1',
      chatId: 'source-chat-1',
      artifacts: [{
        id: 'artifact-1',
        label: 'Decision log',
        fileExtension: '.docx',
        createdAt: '2026-08-09T12:00:00.000Z',
      }],
      sourceLabel: 'Architecture decisions',
      citation: 'We chose pgvector.',
    }];
    render(<Citations citations={priorCitation} />, { wrapper: Wrapper });

    await userEvent.hover(screen.getByTestId('displayed-avatar-0'));
    await userEvent.click(await screen.findByTestId('citation-artifact-artifact-1'));

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Could not open artifact',
      }));
    });
    expect(mockSetSelectedArtifact).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('only selects the artifact from the latest overlapping badge click', async () => {
    const secondArtifact = {
      ...fetchedArtifact,
      id: 'artifact-2',
      label: 'Implementation plan',
    };
    let resolveFirstFetch: (artifact: typeof fetchedArtifact) => void;
    const firstFetch = new Promise<typeof fetchedArtifact>((resolve) => {
      resolveFirstFetch = resolve;
    });
    mockFetchCitedArtifact.mockImplementation(({ artifactId }) => (
      artifactId === 'artifact-1' ? firstFetch : Promise.resolve(secondArtifact)
    ));
    const priorCitation: Citation[] = [{
      contextType: ContextType.PRIOR_CONVERSATION,
      citedMessageId: 'message-1',
      chatId: 'source-chat-1',
      artifacts: [
        {
          id: 'artifact-1',
          label: 'Decision log',
          fileExtension: '.docx',
          createdAt: '2026-08-09T12:00:00.000Z',
        },
        {
          id: 'artifact-2',
          label: 'Implementation plan',
          fileExtension: '.docx',
          createdAt: '2026-08-10T12:00:00.000Z',
        },
      ],
      sourceLabel: 'Architecture decisions',
      citation: 'We chose pgvector.',
    }];
    render(<Citations citations={priorCitation} />, { wrapper: Wrapper });

    await userEvent.hover(screen.getByTestId('displayed-avatar-0'));
    await userEvent.click(await screen.findByTestId('citation-artifact-artifact-1'));
    await userEvent.click(screen.getByTestId('citation-artifact-artifact-2'));

    await waitFor(() => {
      expect(mockSetSelectedArtifact).toHaveBeenCalledWith({
        ...secondArtifact,
        isExternal: true,
      });
    });

    resolveFirstFetch!(fetchedArtifact);
    await firstFetch;
    await Promise.resolve();

    expect(mockSetSelectedArtifact).toHaveBeenCalledTimes(1);
  });

  it('downloads a cited artifact that cannot open in the viewer', async () => {
    const binaryArtifact = {
      ...fetchedArtifact,
      fileExtension: '.pdf',
      content: '',
    };
    mockFetchCitedArtifact.mockResolvedValue(binaryArtifact);
    const priorCitation: Citation[] = [{
      contextType: ContextType.PRIOR_CONVERSATION,
      citedMessageId: 'message-1',
      chatId: 'source-chat-1',
      artifacts: [{
        id: 'artifact-1',
        label: 'Decision log',
        fileExtension: '.pdf',
        createdAt: '2026-08-09T12:00:00.000Z',
      }],
      sourceLabel: 'Architecture decisions',
      citation: 'We chose pgvector.',
    }];
    render(<Citations citations={priorCitation} />, { wrapper: Wrapper });

    await userEvent.hover(screen.getByTestId('displayed-avatar-0'));
    await userEvent.click(await screen.findByTestId('citation-artifact-artifact-1'));

    await waitFor(() => {
      expect(mockDownloadArtifact).toHaveBeenCalledWith(binaryArtifact);
    });
    expect(mockSetSelectedArtifact).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('carries the cited message and the return address when opening a prior conversation', async () => {
    mockChatId = 'citing-chat-1';
    const priorCitation: Citation[] = [{
      contextType: ContextType.PRIOR_CONVERSATION,
      citedMessageId: 'message-1',
      chatId: 'source-chat-1',
      role: 'assistant',
      messageCreatedAt: '2026-08-10T12:00:00.000Z',
      sourceLabel: 'Architecture decisions',
      citation: 'We chose pgvector.',
    }];
    render(
      <ChatProvider chatId='citing-chat-1'>
        <Citations citations={priorCitation} messageId='citing-message-1' />
      </ChatProvider>,
    );

    await userEvent.click(screen.getByTestId('displayed-avatar-0'));
    expect(mockRouterPush).toHaveBeenCalledWith(
      '/chat/source-chat-1?cited_message_id=message-1&return_chat_id=citing-chat-1&return_message_id=citing-message-1',
    );
  });
});
