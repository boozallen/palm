import { router } from '@/server/trpc';
import getPrompt from './get-prompt';
import getPrompts from './get-prompts';
import getBookmarks from './get-bookmarks';
import toggleBookmark from '@/features/library/routes/toggle-bookmark';
import deletePrompt from './delete-prompt';
import updatePrompt from './update-prompt';

export default router({
  updatePrompt,
  deletePrompt,
  getPrompt,
  getPrompts,
  getBookmarks,
  toggleBookmark,
});
