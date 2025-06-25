import { router } from '@/server/trpc';
import getFeatureFlag from './get-feature-flag';
import getAvailableModels from './get-available-models';
import getSystemConfig from './get-system-config';
import getUserKnowledgeBases from './get-user-knowledge-bases';
import getUserPreselectedKnowledgeBases from './get-user-preselected-knowledge-bases';
import getIsUserGroupLead from './get-is-user-group-lead';
import runPrompt from './run-prompt';
import getTags from './get-tags';
import createPrompt from './create-prompt';
import getPromptTagSuggestions from './get-prompt-tag-suggestions';
import getUserAdvancedKbSettings from './get-user-advanced-kb-settings';
import getAvailableAgents from './get-available-agents';
import getUserEnabledAiAgents from './get-user-enabled-ai-agents';

export default router({
  createPrompt,
  getFeatureFlag,
  getAvailableModels,
  getSystemConfig,
  getUserKnowledgeBases,
  getUserPreselectedKnowledgeBases,
  getTags,
  getIsUserGroupLead,
  runPrompt,
  getPromptTagSuggestions,
  getUserAdvancedKbSettings,
  getAvailableAgents,
  getUserEnabledAiAgents,
});
