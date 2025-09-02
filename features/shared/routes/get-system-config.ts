import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';

const outputSchema = z.object({
  systemMessage: z.string(),
  termsOfUseHeader: z.string(),
  termsOfUseBody: z.string(),
  termsOfUseCheckboxLabel: z.string(),
  legalPolicyHeader: z.string(),
  legalPolicyBody: z.string(),
  defaultUserGroupId: z.string().uuid().nullable(),
  systemAiProviderModelId: z.string().uuid().nullable(),
  documentLibraryDocumentUploadProviderId: z.string().uuid().nullable(),
  featureManagementPromptGenerator: z.boolean(),
  featureManagementChatSummarization: z.boolean(),
  featureManagementPromptTagSuggestions: z.boolean(),
});

export default procedure.output(outputSchema).query(async () => {
  const result = await getSystemConfig();

  return {
    systemMessage: result.systemMessage ?? '',
    termsOfUseHeader: result.termsOfUseHeader ?? '',
    termsOfUseBody: result.termsOfUseBody ?? '',
    termsOfUseCheckboxLabel: result.termsOfUseCheckboxLabel ?? '',
    legalPolicyHeader: result.legalPolicyHeader ?? '',
    legalPolicyBody: result.legalPolicyBody ?? '',
    defaultUserGroupId: result.defaultUserGroupId ?? null,
    systemAiProviderModelId: result.systemAiProviderModelId ?? null,
    documentLibraryDocumentUploadProviderId: result.documentLibraryDocumentUploadProviderId || null,
    featureManagementPromptGenerator: result.featureManagementPromptGenerator ?? true,
    featureManagementChatSummarization: result.featureManagementChatSummarization ?? true,
    featureManagementPromptTagSuggestions: result.featureManagementPromptTagSuggestions ?? true,
  };
});
