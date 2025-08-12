import logger from '@/server/logger';
import db from '@/server/db';

export default async function getSystemConfig() {
  try {
    let result = await db.systemConfig.findFirst({
      select: {
        systemMessage: true,
        termsOfUseHeader: true,
        termsOfUseBody: true,
        termsOfUseCheckboxLabel: true,
        legalPolicyHeader: true,
        legalPolicyBody: true,
        defaultUserGroupId: true,
        systemAiProviderModelId: true,
        documentLibraryDocumentUploadProviderId: true,
        featureManagementPromptGenerator: true,
        featureManagementChatSummarization: true,
        featureManagementPromptTagSuggestions: true,
      },
    });

    if (!result) {
      const count = await db.systemConfig.count();

      if (count === 0) {
        result = await db.systemConfig.create({
          data: {},
          select: {
            systemMessage: true,
            termsOfUseHeader: true,
            termsOfUseBody: true,
            termsOfUseCheckboxLabel: true,
            legalPolicyHeader: true,
            legalPolicyBody: true,
            defaultUserGroupId: true,
            systemAiProviderModelId: true,
            documentLibraryDocumentUploadProviderId: true,
            featureManagementPromptGenerator: true,
            featureManagementChatSummarization: true,
            featureManagementPromptTagSuggestions: true,
          },
        });
        logger.debug('db.systemConfig.create', { config: result });
      }
    }

    return {
      systemMessage: result?.systemMessage,
      termsOfUseHeader: result?.termsOfUseHeader,
      termsOfUseBody: result?.termsOfUseBody,
      termsOfUseCheckboxLabel: result?.termsOfUseCheckboxLabel,
      legalPolicyHeader: result?.legalPolicyHeader,
      legalPolicyBody: result?.legalPolicyBody,
      defaultUserGroupId: result?.defaultUserGroupId,
      systemAiProviderModelId: result?.systemAiProviderModelId,
      documentLibraryDocumentUploadProviderId: result?.documentLibraryDocumentUploadProviderId,
      featureManagementPromptGenerator: result?.featureManagementPromptGenerator,
      featureManagementChatSummarization: result?.featureManagementChatSummarization,
      featureManagementPromptTagSuggestions: result?.featureManagementPromptTagSuggestions,
    };
  } catch (error) {
    logger.error('Error getting System Config', error);
    throw new Error('Error getting System Config');
  }
}
