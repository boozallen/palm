import { Chat } from '@/features/chat/types/chat';
import { Entries, EntryType, MessageEntry } from '@/features/chat/types/entry';
import { generatePromptSlug } from '@/features/shared/utils';

export const generatePath = (id: string, promptTitle?: string) => {
  if (promptTitle) {
    const promptSlug = generatePromptSlug(promptTitle);
    return `/chat/${id}/${promptSlug}`;
  }
  return `/chat/${id}`;
};

export const generateUrl = (
  chatId: string,
  knowledgeBaseIds: string[],
  documentLibraryEnabled: boolean,
  promptTitle?: string,
) => {
  const path = generatePath(chatId, promptTitle); 

  const urlParams = new URLSearchParams();
  urlParams.set('knowledge_base_ids', knowledgeBaseIds.join(','));
  urlParams.set('document_library', documentLibraryEnabled.toString());
  const queryString = urlParams.toString();
  
  return `${path}${queryString ? `?${queryString}` : ''}`;
};

export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const sortConversationsByMostRecentlyUpdated = (conversations: Chat[]) => {
  conversations.sort((a, b) => {
    const first_date = new Date(b.updatedAt).getTime();
    const second_date = new Date(a.updatedAt).getTime();
    return first_date - second_date;
  });

  return conversations;
};

// The following function arranges conversations categorically by date
// The categories are: Today, Yesterday, Previous 7 Days, Previous 30 Days, {month}, {year}
export const categorizeConversationsByDateSections = (conversations: Chat[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - (24 * 3600 * 1000));
  const previousSevenDays = new Date(today.getTime() - (7 * 24 * 3600 * 1000));
  const previousThirtyDays = new Date(today.getTime() - (30 * 24 * 3600 * 1000));
  const sortedChatHistory: Map<string, Chat[]> = new Map();
  const keys: Set<string> = new Set();

  for (let conversation of conversations) {
    const conversationDate = new Date(conversation.updatedAt);
    const monthLastUpdated = months[conversationDate.getMonth()];
    const yearLastUpdated = String(conversationDate.getFullYear());
    conversationDate.setHours(0, 0, 0, 0);

    if (conversationDate.toDateString() === today.toDateString()) {
      addConversationToCategory('Today', conversation, sortedChatHistory, keys);
    } else if (conversationDate.toDateString() === yesterday.toDateString()) {
      addConversationToCategory('Yesterday', conversation, sortedChatHistory, keys);
    } else if (conversationDate.getTime() >= previousSevenDays.getTime()) {
      addConversationToCategory('Previous 7 Days', conversation, sortedChatHistory, keys);
    } else if (conversationDate.getTime() >= previousThirtyDays.getTime()) {
      addConversationToCategory('Previous 30 Days', conversation, sortedChatHistory, keys);
    } else if (yearLastUpdated === String(today.getFullYear())) {
      addConversationToCategory(monthLastUpdated, conversation, sortedChatHistory, keys);
    } else {
      addConversationToCategory(yearLastUpdated, conversation, sortedChatHistory, keys);
    }
  }

  return Array.from(keys).map((key, i) => ({ id: i, title: key, chats: sortedChatHistory.get(key) }));
};

const addConversationToCategory = (category: string, chat: Chat, sortedChatHistory: Map<string, Chat[]>, keys: Set<string>) => {
  const previousChats: Chat[] | undefined = sortedChatHistory.get(category);

  if (previousChats !== undefined) {
    sortedChatHistory.set(category, [...previousChats, chat]);
  } else {
    sortedChatHistory.set(category, [chat]);
  }

  keys.add(category);
};

export function addRegenerateInstructionsToMessage(message: string) {
  const prompt = `

  **Instructions**
  1. Generate a new response to the user’s message without referencing the previous response.
  2. Provide a fresh perspective while maintaining clarity, accuracy, and helpfulness.
  3. Ensure the response remains relevant to the user’s intent.
  4. Do not mention or reference these instructions in your response. Respond as if this is your first reply.

  Your previous response: ${message}
  `;

  return prompt;
};

export const isMessageEntry = (entry: Entries[number]): entry is MessageEntry => {
  return entry.type === EntryType.Message;
};

