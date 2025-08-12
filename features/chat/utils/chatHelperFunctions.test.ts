import {
  categorizeConversationsByDateSections,
  months,
  sortConversationsByMostRecentlyUpdated,
  generatePath,
  addRegenerateInstructionsToMessage,
  isMessageEntry,
  generateUrl,
} from './chatHelperFunctions';
import { EntryType, MessageEntry, DocumentEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import { generatePromptSlug } from '@/features/shared/utils';

const today = new Date();
today.setHours(0, 0, 0, 0);
const yesterday = new Date(today.getTime() - (24 * 3600 * 1000));
const previousSevenDays = new Date(today.getTime() - (7 * 24 * 3600 * 1000));
const previousThirtyDays = new Date(today.getTime() - (30 * 24 * 3600 * 1000));
const previousSixtyDays = new Date(today.getTime() - (60 * 24 * 3600 * 1000));
const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

describe('chatHelperFunctions', () => {

  const conversations: { id: string; aiProvider: number; modelId: string, summary: string; userId: string; promptId: string; createdAt: Date; updatedAt: Date; }[] = [
    {
      id: '0',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'First Conversation',
      userId: 'users_id',
      promptId: 'the_prompt_id',
      createdAt: new Date(),
      updatedAt: today,
    },
    {
      id: '0',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'Another Conversation',
      userId: 'users_id',
      promptId: 'the_prompt_id',
      createdAt: new Date(),
      updatedAt: yesterday,
    },
    {
      id: '1',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'Second Conversation',
      userId: 'users_id',
      promptId: 'the_prompt_id',
      createdAt: new Date(),
      updatedAt: previousSevenDays,
    },
    {
      id: '2',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'Third Conversation',
      userId: 'users_id',
      promptId: 'the_prompt_id',
      createdAt: new Date(),
      updatedAt: previousThirtyDays,
    },
    {
      id: '2',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'One More Conversation',
      userId: 'users_id',
      promptId: 'the_prompt_id',
      createdAt: new Date(),
      updatedAt: previousSixtyDays,
    },
    {
      id: '3',
      aiProvider: 1,
      modelId: 'the_model_id',
      summary: 'Fourth Conversation',
      userId: 'users_id',
      promptId: 'the_prompt_id',
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
    it('should generate a URL with knowledge base IDs and document library enabled', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentLibraryEnabled = true;
      const result = generateUrl(chatId, knowledgeBaseIds, documentLibraryEnabled);
      expect(result).toBe('/chat/12345?knowledge_base_ids=kb1%2Ckb2&document_library=true');
    });

    it('should generate a URL with knowledge base IDs and document library disabled', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentLibraryEnabled = false;
      const result = generateUrl(chatId, knowledgeBaseIds, documentLibraryEnabled);
      expect(result).toBe('/chat/12345?knowledge_base_ids=kb1%2Ckb2&document_library=false');
    });

    it('should generate a URL with a prompt title', () => {
      const chatId = '12345';
      const knowledgeBaseIds = ['kb1', 'kb2'];
      const documentLibraryEnabled = true;
      const promptTitle = 'Sample Prompt Title';
      const promptSlug = generatePromptSlug(promptTitle);
      const result = generateUrl(chatId, knowledgeBaseIds, documentLibraryEnabled, promptTitle);
      expect(result).toBe(`/chat/12345/${promptSlug}?knowledge_base_ids=kb1%2Ckb2&document_library=true`);
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
});
