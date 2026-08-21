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
  joinUserGroupDialogExternalLink: z.string(),
  defaultUserGroupId: z.string().uuid().nullable(),
  systemAiProviderModelId: z.string().uuid().nullable(),
  knowledgeGraphAiProviderModelId: z.string().uuid().nullable(),
  knowledgeGraphEntityResolutionEnabled: z.boolean(),
  memoryEnabled: z.boolean(),
  documentLibraryDocumentUploadProviderId: z.string().uuid().nullable(),
  featureManagementPromptGenerator: z.boolean(),
  featureManagementChatSummarization: z.boolean(),
  featureManagementPromptTagSuggestions: z.boolean(),
  documentLibraryDataSharingEnabled: z.boolean(),
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
    joinUserGroupDialogExternalLink: result.joinUserGroupDialogExternalLink ?? '',
    defaultUserGroupId: result.defaultUserGroupId ?? null,
    systemAiProviderModelId: result.systemAiProviderModelId ?? null,
    knowledgeGraphAiProviderModelId: result.knowledgeGraphAiProviderModelId ?? null,
    knowledgeGraphEntityResolutionEnabled: result.knowledgeGraphEntityResolutionEnabled ?? false,
    memoryEnabled: result.memoryEnabled ?? false,
    documentLibraryDocumentUploadProviderId: result.documentLibraryDocumentUploadProviderId || null,
    featureManagementPromptGenerator: result.featureManagementPromptGenerator ?? true,
    featureManagementChatSummarization: result.featureManagementChatSummarization ?? true,
    featureManagementPromptTagSuggestions: result.featureManagementPromptTagSuggestions ?? true,
    documentLibraryDataSharingEnabled: result.documentLibraryDataSharingEnabled ?? false,
  };
});
