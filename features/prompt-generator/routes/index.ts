import { router } from '@/server/trpc';
import generatePrompt from './generate-prompt';

export default router({
  generatePrompt,
});
