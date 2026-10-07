import { router } from '@/server/trpc';
import generatePrompt from './generate-prompt';
import { getGeneratePromptStatus } from './get-generate-prompt-status';

export default router({
  generatePrompt,
  getGeneratePromptStatus,
});
