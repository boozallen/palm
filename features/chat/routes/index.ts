import { router } from '@/server/trpc';
import deleteMessage from './delete-message';
import getUserChat from './get-chat';
import getMessages from './get-messages';
import getOriginPrompt from './get-origin-prompt';
import createChat from './create-chat';
import addMessage from './add-message';
import getChats from './get-chats';
import deleteChat from './delete-chat';
import retryMessage from './retry-message';
import updateChatConversationSummary from './update-chat-conversation-summary';
import updateMessage from './update-message';

export default router({
  deleteMessage,
  createChat,
  addMessage,
  getUserChat,
  getMessages,
  getOriginPrompt,
  getChats,
  deleteChat,
  retryMessage,
  updateChatConversationSummary,
  updateMessage,
});
