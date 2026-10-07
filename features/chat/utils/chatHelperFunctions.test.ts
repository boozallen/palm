import { renderHook } from '@testing-library/react';
import {
  categorizeConversationsByDateSections,
  months,
  sortConversationsByMostRecentlyUpdated,
  generatePath,
  generateCitationUrl,
  addRegenerateInstructionsToMessage,
  isMessageEntry,
  generateUrl,
  addSystemInstructions,
  getFileTypeConfig,
  getSourceConfig,
  useGreeting,
} from './chatHelperFunctions';
import { EntryType, MessageEntry, DocumentEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import { generatePromptSlug } from '@/features/shared/utils';
import { Document, DocumentUploadStatus } from '@/features/shared/types/document';
import { UserKnowledgeBase } from '@/features/shared/types/knowledge-base';
import { IconBinaryTree2, IconDatabase, IconFileText, IconFileSpreadsheet, IconFileDescription, IconFileMusic, IconFileCode } from '@tabler/icons-react';

const today = new Date();
today.setHours(0, 0, 0, 0);
const yesterday = new Date(today.getTime() - (24 * 3600 * 1000));
const previousSevenDays = new Date(today.getTime() - (7 * 24 * 3600 * 1000));
const previousThirtyDays = new Date(today.getTime() - (30 * 24 * 3600 * 1000));
const previousSixtyDays = new Date(today.getTime() - (60 * 24 * 3600 * 1000));
const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

describe('useGreeting', () => {
  const mockDate = (hour: number) => {
    jest.spyOn(global, 'Date').mockImplementation(() => ({ getHours: () => hour } as unknown as Date));
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses "Morning" for hours before 12', () => {
    mockDate(9);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => useGreeting());
    expect(result.current).toBe('Good Morning');
  });

  it('uses "Afternoon" for hours 12–16', () => {
    mockDate(14);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => useGreeting());
    expect(result.current).toBe('Good Afternoon');
  });

  it('uses "Evening" for hours 17 and later', () => {
    mockDate(20);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => useGreeting());
    expect(result.current).toBe('Good Evening');
  });

  it('returns "Good {timeOfDay}, {firstName}" when pick is 0', () => {
    mockDate(9);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => useGreeting('Jane Smith'));
    expect(result.current).toBe('Good Morning, Jane');
  });

  it('returns "{timeOfDay}, {firstName}" when pick is 1', () => {
    mockDate(9);
    jest.spyOn(Math, 'floor').mockReturnValue(1);
    const { result } = renderHook(() => useGreeting('Jane Smith'));
    expect(result.current).toBe('Morning, Jane');
  });

  it('returns "Hello, {firstName}" when pick is 2', () => {
    mockDate(9);
    jest.spyOn(Math, 'floor').mockReturnValue(2);
    const { result } = renderHook(() => useGreeting('Jane Smith'));
    expect(result.current).toBe('Hello, Jane');
  });

  it('returns "Hello" with no name when pick is 2', () => {
    mockDate(9);
    jest.spyOn(Math, 'floor').mockReturnValue(2);
    const { result } = renderHook(() => useGreeting());
    expect(result.current).toBe('Hello');
  });

  it('parses "Last, First" name format', () => {
    mockDate(9);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => useGreeting('Smith, Jane'));
    expect(result.current).toBe('Good Morning, Jane');
  });

  it('ignores suffix in "Last, First Suffix" name format', () => {
    mockDate(9);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => useGreeting('Smith, Jane III'));
    expect(result.current).toBe('Good Morning, Jane');
  });
});

describe('chatHelperFunctions', () => {

  const conversations: { id: string; aiProvider: number; modelId: string, summary: string; useCase: string | null; userId: string; promptId: string; agentProviderId: string | null; externalSessionId: string | null; userGroupId: string | null; createdAt: Date; updatedAt: Date; }[] = [
    {
      id: '0',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'First Conversation',
      useCase: null,
      userId: 'users_id',
      promptId: 'the_prompt_id',
      agentProviderId: null,
      externalSessionId: null,
      userGroupId: null,
      createdAt: new Date(),
      updatedAt: today,
    },
    {
      id: '0',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'Another Conversation',
      useCase: null,
      userId: 'users_id',
      promptId: 'the_prompt_id',
      agentProviderId: null,
      externalSessionId: null,
      userGroupId: null,
      createdAt: new Date(),
      updatedAt: yesterday,
    },
    {
      id: '1',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'Second Conversation',
      useCase: null,
      userId: 'users_id',
      promptId: 'the_prompt_id',
      agentProviderId: null,
      externalSessionId: null,
      userGroupId: null,
      createdAt: new Date(),
      updatedAt: previousSevenDays,
    },
    {
      id: '2',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'Third Conversation',
      useCase: null,
      userId: 'users_id',
      promptId: 'the_prompt_id',
      agentProviderId: null,
      externalSessionId: null,
      userGroupId: null,
      createdAt: new Date(),
      updatedAt: previousThirtyDays,
    },
    {
      id: '2',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'One More Conversation',
      useCase: null,
      userId: 'users_id',
      promptId: 'the_prompt_id',
      agentProviderId: null,
      externalSessionId: null,
      userGroupId: null,
      createdAt: new Date(),
      updatedAt: previousSixtyDays,
    },
    {
      id: '3',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'Fourth Conversation',
      useCase: null,
      userId: 'users_id',
      promptId: 'the_prompt_id',
      agentProviderId: null,
      externalSessionId: null,
      userGroupId: null,
      createdAt: new Date(),
      updatedAt: lastYear,
    },
  ];

  describe('sortConversationsByMostRecentlyUpdated', () => {
    it('Correctly sorts users conversation by date', () => {
      const result = sortConversationsByMostRecentlyUpdated(conversations);
      expect(result[0].updatedAt).toBe(today);
      expect(result[1].updatedAt).toBe(yesterday);
      expect(result[2].updatedAt).toBe(previousSevenDays);
      expect(result[3].updatedAt).toBe(previousThirtyDays);
      expect(result[4].updatedAt).toBe(previousSixtyDays);
      expect(result[5].updatedAt).toBe(lastYear);
    });
  });

  describe('categorizeConversationsByDateSections', () => {
    it('Correctly sorts conversations into date categories', () => {
      const sortedConversations = sortConversationsByMostRecentlyUpdated(conversations);
      const result = categorizeConversationsByDateSections(sortedConversations);
      // Handle previous month belonging to previous year (i.e., January '24 <- December '23)
      if (previousSixtyDays.getFullYear() === lastYear.getFullYear()) {
        expect(result).toHaveLength(5);
        expect(result[0].title).toBe('Today');
        expect(result[1].title).toBe('Yesterday');
        expect(result[2].title).toBe('Previous 7 Days');
        expect(result[3].title).toBe('Previous 30 Days');
        expect(result[4].title).toBe(String(lastYear.getFullYear()));
      }
      else {
        expect(result).toHaveLength(6);
        expect(result[0].title).toBe('Today');
        expect(result[1].title).toBe('Yesterday');
        expect(result[2].title).toBe('Previous 7 Days');
        expect(result[3].title).toBe('Previous 30 Days');
        expect(result[4].title).toBe(months[previousSixtyDays.getMonth()]);
        expect(result[5].title).toBe(String(lastYear.getFullYear()));
      }
    });
  });

  describe('generatePath', () => {
    it('should generate a URL without a prompt title', () => {
      const id = '12345';
      const result = generatePath(id);
      expect(result).toBe(`/chat/${id}`);
    });

    it('should generate a URL with a prompt title', () => {
      const id = '12345';
      const promptTitle = 'Sample Prompt Title';
      const promptSlug = generatePromptSlug(promptTitle);
      const result = generatePath(id, promptTitle);
      expect(result).toBe(`/chat/${id}/${promptSlug}`);
    });
  });

  describe('generateUrl', () => {
    it('should generate a URL with knowledge base IDs, document IDs and default sources sidebar state', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentIds = ['doc1', 'doc2'];
      const result = generateUrl(chatId, knowledgeBaseIds, documentIds);
      expect(result).toBe('/chat/12345?knowledge_base_ids=kb1%2Ckb2&document_ids=doc1%2Cdoc2&sources_sidebar_expanded=false&use_graph=false');
    });

    it('should generate a URL with knowledge base IDs, document IDs and document library disabled', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentIds: string[] = [];
      const result = generateUrl(chatId, knowledgeBaseIds, documentIds);
      expect(result).toBe('/chat/12345?knowledge_base_ids=kb1%2Ckb2&document_ids=&sources_sidebar_expanded=false&use_graph=false');
    });

    it('should generate a URL with empty document IDs array', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentIds: string[] = [];
      const result = generateUrl(chatId, knowledgeBaseIds, documentIds);
      expect(result).toBe('/chat/12345?knowledge_base_ids=kb1%2Ckb2&document_ids=&sources_sidebar_expanded=false&use_graph=false');
    });

    it('should generate a URL with a prompt title', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentIds = ['doc1', 'doc2'];
      const promptTitle = 'Sample Prompt Title';
      const promptSlug = generatePromptSlug(promptTitle);
      const result = generateUrl(chatId, knowledgeBaseIds, documentIds, promptTitle);
      expect(result).toBe(`/chat/12345/${promptSlug}?knowledge_base_ids=kb1%2Ckb2&document_ids=doc1%2Cdoc2&sources_sidebar_expanded=false&use_graph=false`);
    });

    it('should generate a URL with sources sidebar expanded set to true', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentIds = ['doc1', 'doc2'];
      const result = generateUrl(chatId, knowledgeBaseIds, documentIds, undefined, true);
      expect(result).toBe('/chat/12345?knowledge_base_ids=kb1%2Ckb2&document_ids=doc1%2Cdoc2&sources_sidebar_expanded=true&use_graph=false');
    });

    it('should generate a URL with all parameters including prompt title and sources sidebar expanded', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentIds = ['doc1', 'doc2'];
      const promptTitle = 'Sample Prompt Title';
      const promptSlug = generatePromptSlug(promptTitle);
      const result = generateUrl(chatId, knowledgeBaseIds, documentIds, promptTitle, true);
      expect(result).toBe(`/chat/12345/${promptSlug}?knowledge_base_ids=kb1%2Ckb2&document_ids=doc1%2Cdoc2&sources_sidebar_expanded=true&use_graph=false`);
    });

    it('should generate a URL with useGraph set to true', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentIds = ['doc1', 'doc2'];
      const result = generateUrl(chatId, knowledgeBaseIds, documentIds, undefined, undefined, true);
      expect(result).toBe('/chat/12345?knowledge_base_ids=kb1%2Ckb2&document_ids=doc1%2Cdoc2&sources_sidebar_expanded=false&use_graph=true');
    });

    it('should generate a URL with all parameters including useGraph', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentIds = ['doc1', 'doc2'];
      const promptTitle = 'Sample Prompt Title';
      const promptSlug = generatePromptSlug(promptTitle);
      const result = generateUrl(chatId, knowledgeBaseIds, documentIds, promptTitle, true, true);
      expect(result).toBe(`/chat/12345/${promptSlug}?knowledge_base_ids=kb1%2Ckb2&document_ids=doc1%2Cdoc2&sources_sidebar_expanded=true&use_graph=true`);
    });
  });

  describe('addRegenerateInstructionsToMessage', () => {
    it('includes previous response in the prompt', () => {
      const previousResponse = 'This is a test message not included in original prompt';

      const prompt = addRegenerateInstructionsToMessage(previousResponse);

      expect(prompt).toContain(previousResponse);
    });
  });
});

describe('isMessageEntry', () => {
  it('should return true for a MessageEntry', () => {
    const messageEntry: MessageEntry = {
      id: '1',
      chatId: 'chat1',
      type: EntryType.Message,
      role: MessageRole.User,
      content: 'Hello, world!',
      createdAt: new Date(),
      deepResearch: false,
    };

    expect(isMessageEntry(messageEntry)).toBe(true);
  });

  it('should return false for a DocumentEntry', () => {
    const documentEntry: DocumentEntry = {
      id: '2',
      chatId: 'chat1',
      type: EntryType.Document,
      filename: 'document.pdf',
      createdAt: new Date(),
    };

    expect(isMessageEntry(documentEntry)).toBe(false);
  });

  describe('addSystemInstructions', () => {
    const mockAvailableKnowledgeBases: UserKnowledgeBase[] = [
      { id: 'kb1', label: 'Knowledge Base 1', kbProviderId: 'provider1', kbProviderLabel: 'Provider 1' },
      { id: 'kb2', label: 'Knowledge Base 2', kbProviderId: 'provider2', kbProviderLabel: 'Provider 2' },
    ];
    const mockSelectedKnowledgeBases: UserKnowledgeBase[] = [
      { id: 'kb1', label: 'Knowledge Base 1', kbProviderId: 'provider1', kbProviderLabel: 'Provider 1' },
    ];
    const mockAvailableDocuments: Document[] = [
      { id: 'doc1', filename: 'document1.pdf', userId: 'user1', uploadStatus: DocumentUploadStatus.Completed, createdAt: new Date(), adminCreated: false },
      { id: 'doc2', filename: 'document2.pdf', userId: 'user1', uploadStatus: DocumentUploadStatus.Completed, createdAt: new Date(), adminCreated: false },
    ];
    const mockSelectedDocuments: Document[] = [
      { id: 'doc1', filename: 'document1.pdf', userId: 'user1', uploadStatus: DocumentUploadStatus.Completed, createdAt: new Date(), adminCreated: false },
    ];

    it('appends user message', () => {
      const stubMessage = 'This is a test message';
      const documentsWithSelectionState = mockAvailableDocuments.map(doc => ({
        ...doc,
        selected: mockSelectedDocuments.some(selectedDoc => selectedDoc.id === doc.id),
      }));

      const result = addSystemInstructions(
        stubMessage,
        mockAvailableKnowledgeBases,
        mockSelectedKnowledgeBases,
        true,
        documentsWithSelectionState
      );

      expect(result).toContain(stubMessage);
    });

    it('adds artifact instructions', () => {
      const documentsWithSelectionState = mockAvailableDocuments.map(doc => ({
        ...doc,
        selected: mockSelectedDocuments.some(selectedDoc => selectedDoc.id === doc.id),
      }));
      
      const result = addSystemInstructions(
        'this is a test',
        mockAvailableKnowledgeBases,
        mockSelectedKnowledgeBases,
        true,
        documentsWithSelectionState
      );

      expect(result).toContain('## Artifacts');
    });

    it('adds follow up questions instructions', () => {
      const documentsWithSelectionState = mockAvailableDocuments.map(doc => ({
        ...doc,
        selected: mockSelectedDocuments.some(selectedDoc => selectedDoc.id === doc.id),
      }));
      
      const result = addSystemInstructions(
        'this is a test',
        mockAvailableKnowledgeBases,
        mockSelectedKnowledgeBases,
        true,
        documentsWithSelectionState
      );

      expect(result).toContain('## Follow Up Questions');
    });

    it('includes knowledge base context when knowledge bases are available', () => {
      const result = addSystemInstructions(
        'test message',
        mockAvailableKnowledgeBases,
        mockSelectedKnowledgeBases,
        false,
        []
      );

      expect(result).toContain('Knowledge Bases feature');
      expect(result).toContain('2 Knowledge Bases');
      expect(result).toContain('Knowledge Base 1');
    });

    it('includes document library context when enabled', () => {
      const documentsWithSelectionState = mockAvailableDocuments.map(doc => ({
        ...doc,
        selected: mockSelectedDocuments.some(selectedDoc => selectedDoc.id === doc.id),
      }));
      
      const result = addSystemInstructions(
        'test message',
        [],
        [],
        true,
        documentsWithSelectionState
      );

      expect(result).toContain('Document Library feature');
      expect(result).toContain('2 files');
      expect(result).toContain('document1.pdf');
    });

    it('does not include document library context when disabled', () => {
      const result = addSystemInstructions(
        'test message',
        [],
        [],
        false,
        []
      );

      expect(result).not.toContain('Document Library feature');
    });

  });

  describe('getFileTypeConfig', () => {
    it('should return red color and file description icon for PDF files', () => {
      const result = getFileTypeConfig('document.pdf');
      expect(result.color).toBe('red.6');
      expect(result.icon).toBe(IconFileDescription);
    });

    it('should return green color and spreadsheet icon for Excel files', () => {
      const result = getFileTypeConfig('spreadsheet.xlsx');
      expect(result.color).toBe('green.6');
      expect(result.icon).toBe(IconFileSpreadsheet);
    });

    it('should return green color and spreadsheet icon for CSV files', () => {
      const result = getFileTypeConfig('data.csv');
      expect(result.color).toBe('green.6');
      expect(result.icon).toBe(IconFileSpreadsheet);
    });

    it('should return orange color and code icon for JSON files', () => {
      const result = getFileTypeConfig('config.json');
      expect(result.color).toBe('orange.6');
      expect(result.icon).toBe(IconFileCode);
    });

    it('should return violet color and binary tree icon for Mermaid files', () => {
      const result = getFileTypeConfig('diagram.mmd');
      expect(result.color).toBe('violet.6');
      expect(result.icon).toBe(IconBinaryTree2);
    });

    it('should return grey color and code icon for HTML files', () => {
      const result = getFileTypeConfig('page.html');
      expect(result.color).toBe('gray.6');
      expect(result.icon).toBe(IconFileCode);
    });

    it('should return grey color and code icon for Markdown files', () => {
      const result = getFileTypeConfig('README.md');
      expect(result.color).toBe('gray.6');
      expect(result.icon).toBe(IconFileCode);
    });

    it('should return purple color and music icon for MP3 files', () => {
      const result = getFileTypeConfig('audio.mp3');
      expect(result.color).toBe('purple');
      expect(result.icon).toBe(IconFileMusic);
    });

    it('should return purple color and music icon for M4A files', () => {
      const result = getFileTypeConfig('audio.m4a');
      expect(result.color).toBe('purple');
      expect(result.icon).toBe(IconFileMusic);
    });

    it('should return purple color and music icon for WAV files', () => {
      const result = getFileTypeConfig('audio.wav');
      expect(result.color).toBe('purple');
      expect(result.icon).toBe(IconFileMusic);
    });

    it('should return purple color and music icon for audio files with uppercase extensions', () => {
      const result = getFileTypeConfig('AUDIO.MP3');
      expect(result.color).toBe('purple');
      expect(result.icon).toBe(IconFileMusic);
    });

    it('should return blue color and text icon for unknown file types', () => {
      const result = getFileTypeConfig('unknown.xyz');
      expect(result.color).toBe('blue.6');
      expect(result.icon).toBe(IconFileText);
    });

    it('should return blue color and text icon for files without extensions', () => {
      const result = getFileTypeConfig('filename');
      expect(result.color).toBe('blue.6');
      expect(result.icon).toBe(IconFileText);
    });
  });

  describe('getSourceConfig', () => {
    it('should return database icon and gray color for knowledge-base source', () => {
      const source = { id: 'kb1', label: 'Knowledge Base 1', type: 'knowledge-base' as const };
      const result = getSourceConfig(source);
      expect(result.color).toBe('gray.6');
      expect(result.icon).toBe(IconDatabase);
    });

    it('should return file type config for document source with PDF', () => {
      const source = { id: 'doc1', label: 'document.pdf', type: 'document' as const };
      const result = getSourceConfig(source);
      expect(result.color).toBe('red.6');
      expect(result.icon).toBe(IconFileDescription);
    });

    it('should return file type config for document source with Excel', () => {
      const source = { id: 'doc2', label: 'spreadsheet.xlsx', type: 'document' as const };
      const result = getSourceConfig(source);
      expect(result.color).toBe('green.6');
      expect(result.icon).toBe(IconFileSpreadsheet);
    });

    it('should return file type config for document source with unknown type', () => {
      const source = { id: 'doc3', label: 'unknown.xyz', type: 'document' as const };
      const result = getSourceConfig(source);
      expect(result.color).toBe('blue.6');
      expect(result.icon).toBe(IconFileText);
    });
  });

  describe('generateCitationUrl', () => {
    it('builds the outbound citation url with return address', () => {
      expect(generateCitationUrl('source-chat', 'cited-msg', 'citing-chat', 'citing-msg')).toBe(
        '/chat/source-chat?cited_message_id=cited-msg&return_chat_id=citing-chat&return_message_id=citing-msg',
      );
    });

    it('omits absent params and never sets source-selection params', () => {
      expect(generateCitationUrl('source-chat', 'cited-msg')).toBe(
        '/chat/source-chat?cited_message_id=cited-msg',
      );
      expect(generateCitationUrl('citing-chat')).toBe('/chat/citing-chat');
      expect(generateCitationUrl('source-chat', 'cited-msg', 'citing-chat', 'citing-msg')).not.toContain('document_ids');
    });
  });
});
