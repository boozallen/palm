import { router } from '@/server/trpc';
import playgroundPrompt from './playground-prompt';
import { getPlaygroundStatus } from './get-playground-status';

export default router({
  playgroundPrompt,
  getPlaygroundStatus,
});
