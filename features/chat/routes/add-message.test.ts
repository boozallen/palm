import { waitFor } from '@testing-library/react';

import { ContextType } from '@/server/trpc-context';
import { UserRole } from '@/features/shared/types/user';
import { ContextType as CitationContextType, MessageRole } from '@/features/chat/types/message';
import logger from '@/server/logger';
import chatRouter from '@/features/chat/routes';
import getChat from '@/features/chat/dal/getChat';
import getMessages from '@/features/chat/dal/getMessages';
import createMessages from '@/features/chat/dal/createMessages';
import getContentFromKbs from '@/features/chat/knowledge-bases/getContentFromKbs';
import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';
import {
  extractArtifactsFromMessage,
  addChatMessageIdToArtifacts,
} from '@/features/chat/utils/artifactHelperFunctions';
import {
  extractFollowUpQuestionsFromMessage,
} from '@/features/chat/utils/followUpQuestionsHelpers';
import {
  addSystemInstructions,
} from '@/features/chat/utils/chatHelperFunctions';
import { embedContent } from '@/features/shared/dal/document-upload/embedContent';
import getEmbeddings from '@/features/chat/dal/getEmbeddings';

jest.mock('@/features/chat/dal/createMessages');
jest.mock('@/features/chat/dal/getChat');
jest.mock('@/features/chat/dal/getEmbeddings');
jest.mock('@/features/chat/dal/getMessages');
jest.mock('@/features/chat/knowledge-bases/getContentFromKbs');
jest.mock('@/features/chat/knowledge-bases/addContextToMessage');
jest.mock('@/features/chat/utils/artifactHelperFunctions');
jest.mock('@/features/chat/utils/followUpQuestionsHelpers');
jest.mock('@/features/chat/utils/chatHelperFunctions');
jest.mock('@/features/shared/dal/document-upload/embedContent', () => ({
  embedContent: jest.fn(),
}));

describe('add-message', () => {
  const mockUserId = '570e3594-0ff3-475d-9ee0-4be261e6b8db';
  const mockChatId = 'fcc14cff-37ba-42bb-8d83-c5618d25acd3';
  const mockMessage = 'What is the best color?';
  const mockModelId = '552079c8-53aa-4614-92fb-8eb5780eea4e';
  const mockModelExternalId = 'gpt-4o';
  const mockKnowledgeBaseIds = [
    'eb254f6b-5f3c-4fe8-a4d3-3de4bda7f723',
    '04118368-0222-4aba-8f4d-21eeaf7c5cad',
    'c3bcae58-84d6-4870-9948-bb2e55857980',
  ];
  const mockDocumentLibraryEnabled = false;

  const mockEmbeddedQuery = {
    embeddings: [{ embedding: [0.23432, -0.123894] }],
  };

  const mockRetrievedEmbeddings = [
    {
      id: '28927a2e-1356-4a75-a860-7f921176695e',
      content: 'These are embeddings retrieved from getEmbeddings',
      score: 0.52,
      citation: {
        documentLabel: 'test-document.pdf',
        documentId: '7212c3ef-b1dc-4eef-b031-8bfe3ef81432',
      },
    },
  ];

  const mockGetChatResolvedValue = {
    id: mockChatId,
    userId: mockUserId,
    modelId: mockModelId,
    promptId: null,
    summary: 'Chat summary',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGetMessagesResolvedValue = [
    {
      id: 'b96e13a2-08fb-4d9f-bdf7-4419ca5d42b5',
      chatId: mockChatId,
      role: MessageRole.User,
      content: 'What is the best color?',
      createdAt: new Date(),
    },
    {
      id: '70a17cbc-7eab-40d0-9e1e-ed1b72e9eb35',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'This is the AI response',
      createdAt: new Date(),
    },
  ];

  const mockAiResponse = {
    text: 'This is the AI response',
  };

  const mockArtifactContent = 'This is the AI response\n````artifact(".txt","artifact label")\nartifact content\n````';

  const mockAiResponseWithArtifact = {
    text: mockArtifactContent,
  };

  const testDate = new Date();

  const mockExtractedArtifacts = [
    {
      id: 'd3b07384-d9f3-4f2e-8f3d-9e1e4bda7f72',
      label: 'artifact label',
      content: 'artifact content',
      fileExtension: '.txt',
      createdAt: testDate,
    },
  ];

  const mockCreateMessagesResolvedValueWithArtifacts = [
    {
      id: '6fd5972f-d199-4104-a5e9-dfb1641e49d8',
      chatId: mockChatId,
      role: MessageRole.User,
      content: mockMessage,
      createdAt: testDate,
      citations: [],
      artifacts: [],
      followUps: [],
    },
    {
      id: '5ffc25fe-0f6f-4022-ae18-15679a76e2a1',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'This is the AI response',
      createdAt: testDate,
      citations: [],
      artifacts: [
        {
          id: 'd3b07384-d9f3-4f2e-8f3d-9e1e4bda7f72',
          chatMessageId: '5ffc25fe-0f6f-4022-ae18-15679a76e2a1',
          label: 'artifact label',
          content: 'artifact content',
          fileExtension: '.txt',
          createdAt: testDate,
        },
      ],
      followUps: [],
    },
  ];

  const mockCreateMessagesResolvedValueWithoutArtifacts = [
    {
      id: '6fd5972f-d199-4104-a5e9-dfb1641e49d8',
      chatId: mockChatId,
      role: MessageRole.User,
      content: mockMessage,
      createdAt: testDate,
      citations: [],
      artifacts: [],
      followUps: [],
    },
    {
      id: '5ffc25fe-0f6f-4022-ae18-15679a76e2a1',
      chatId: mockChatId,
      role: MessageRole.Assistant,
      content: 'This is the AI response',
      createdAt: testDate,
      citations: [],
      artifacts: [],
      followUps: [],
    },
  ];

  const mockInput = {
    chatId: mockChatId,
    message: mockMessage,
    knowledgeBaseIds: mockKnowledgeBaseIds,
    documentLibraryEnabled: mockDocumentLibraryEnabled,
  };

  const kbResultsMock = {
    citations: [{
      contextType: CitationContextType.KNOWLEDGE_BASE,
      sourceLabel: 'My knowledge base',
      knowledgeBaseId: 'knowledge-base-test-id',
      citation: 'This is test content',
    }],
    failedKbs: ['The Book of Colors', 'Full Spectrum'],
  };

  const kbEnhancedMessage = 'Message enhanced with kb';

  const chatCompletion = jest.fn();
  const buildUserSource = jest.fn();

  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    (getChat as jest.Mock).mockResolvedValue(mockGetChatResolvedValue);
    (getMessages as jest.Mock).mockResolvedValue(mockGetMessagesResolvedValue);
    (addContextToMessage as jest.Mock).mockReturnValue(kbEnhancedMessage);
    (getContentFromKbs as jest.Mock).mockResolvedValue(kbResultsMock);

    (addSystemInstructions as jest.Mock).mockReturnValue('Message with custom instructions');
    (extractArtifactsFromMessage as jest.Mock).mockReturnValue({
      artifacts: mockExtractedArtifacts,
      cleanedText: 'This is the AI response',
    });
    (extractFollowUpQuestionsFromMessage as jest.Mock).mockReturnValue({
      followUpQuestions: [],
      cleanedText: 'This is the AI response',
    });
    (addChatMessageIdToArtifacts as jest.Mock).mockImplementation();
    (embedContent as jest.Mock).mockReturnValue(mockEmbeddedQuery);
    (getEmbeddings as jest.Mock).mockReturnValue(mockRetrievedEmbeddings);

    chatCompletion.mockResolvedValue(mockAiResponse);

    buildUserSource.mockResolvedValue({
      source: {
        chatCompletion,
      },
      model: {
        externalId: mockModelExternalId,
      },
    });

    ctx = {
      userId: mockUserId,
      userRole: UserRole.User,
      ai: {
        buildUserSource,
      },
      logger: logger,
    } as unknown as ContextType;
  });

  it('returns assistant message that contains artifacts', async () => {
    chatCompletion.mockResolvedValue(mockAiResponseWithArtifact);

    (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithArtifacts);

    const caller = chatRouter.createCaller(ctx);
    const result = await caller.addMessage(mockInput);

    expect(result.messages[1].artifacts).toHaveLength(1);
    expect(result.messages[1].artifacts[0]).toMatchObject({
      chatMessageId: '5ffc25fe-0f6f-4022-ae18-15679a76e2a1',
      label: 'artifact label',
      content: 'artifact content',
      fileExtension: '.txt',
    });

    expect(addSystemInstructions).toHaveBeenCalled();
    expect(extractArtifactsFromMessage).toHaveBeenCalledWith(mockArtifactContent);
    expect(addChatMessageIdToArtifacts).toHaveBeenCalled();
  });

  it('returns assistant message that does not contain artifacts', async () => {
    chatCompletion.mockResolvedValue(mockAiResponse);

    (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithoutArtifacts);

    const caller = chatRouter.createCaller(ctx);
    const result = await caller.addMessage(mockInput);

    expect(result.messages[1].artifacts).toHaveLength(0);

    expect(addSystemInstructions).toHaveBeenCalled();
    expect(extractArtifactsFromMessage).toHaveBeenCalledWith(mockAiResponse.text);
    expect(addChatMessageIdToArtifacts).toHaveBeenCalled();
  });

  it('throws error if user does not own chat and is not an admin', async () => {
    ctx.userId = 'some-other-user-id';

    const caller = chatRouter.createCaller(ctx);

    await expect(caller.addMessage(mockInput)).rejects.toThrow('You do not have permission to use this chat');

    await waitFor(() => {
      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });

  it('throws error if the modelId is not set', async () => {
    (getChat as jest.Mock).mockResolvedValue({
      ...mockGetChatResolvedValue,
      modelId: '',
    });

    const caller = chatRouter.createCaller(ctx);

    await expect(caller.addMessage(mockInput)).rejects.toThrow('Model for chat has not been set');

    await waitFor(() => {
      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });

  it('does call knowledge base functions', async () => {
    (createMessages as jest.Mock).mockResolvedValue(mockCreateMessagesResolvedValueWithoutArtifacts);

    const caller = chatRouter.createCaller(ctx);

    await caller.addMessage(mockInput);

    expect(getContentFromKbs).toHaveBeenCalledWith(ctx, {
      message: mockMessage,
      knowledgeBaseIds: mockKnowledgeBaseIds,
    });

    expect(addContextToMessage).toHaveBeenCalledWith(
      mockMessage,
      kbResultsMock.citations.map((citation) => ({
        citation: citation.citation,
        knowledgeBaseId: citation.knowledgeBaseId,
        contextType: CitationContextType.KNOWLEDGE_BASE,
        sourceLabel: citation.sourceLabel,
      })),
    );
  });

  describe('Document Library Enabled', () => {

    it('should create user embeddings', async () => {
      const caller = chatRouter.createCaller(ctx);

      await caller.addMessage({ ...mockInput, documentLibraryEnabled: true });

      expect(embedContent).toHaveBeenCalledWith(mockInput.message, ctx.userId);
    });

    it('should not create user embeddings if document library is not enabled', async () => {
      const caller = chatRouter.createCaller(ctx);

      await caller.addMessage({ ...mockInput });

      expect(embedContent).not.toHaveBeenCalled();
    });

    it('should throw if embedding fails', async () => {
      (embedContent as jest.Mock).mockReturnValue({ embeddings: undefined });

      const caller = chatRouter.createCaller(ctx);

      await expect(caller.addMessage({ ...mockInput, documentLibraryEnabled: true })).rejects.toThrow(
        /wrong embedding your message/i
      );
    });

    it('should call getEmbeddings with embedded query', async () => {
      const caller = chatRouter.createCaller(ctx);

      await caller.addMessage({ ...mockInput, documentLibraryEnabled: true });

      expect(getEmbeddings).toHaveBeenCalledWith(
        {
          userId: ctx.userId,
          embeddedQuery: mockEmbeddedQuery.embeddings[0].embedding,
        }
      );
    });
  });
});
