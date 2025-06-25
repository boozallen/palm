import { BedrockSchema, KbProviderConfig, KbProviderType, PalmSchema } from '@/features/shared/types';

export default function mergeKbProviderConfig(existingConfig: KbProviderConfig, inputConfig: KbProviderConfig, existingProvider: KbProviderType): KbProviderConfig {

  switch (existingProvider) {
    case KbProviderType.KbProviderPalm:
      const palmConfig = existingConfig as PalmSchema;
      const inputPalmConfig = inputConfig as PalmSchema;
      return {
        apiEndpoint: inputPalmConfig.apiEndpoint,
        apiKey: inputPalmConfig.apiKey ? inputPalmConfig.apiKey : palmConfig.apiKey,
      };
    case KbProviderType.KbProviderBedrock:
      const bedrockConfig = existingConfig as BedrockSchema;
      const inputBedrockConfig = inputConfig as BedrockSchema;
      return {
        accessKeyId: inputBedrockConfig.accessKeyId ? inputBedrockConfig.accessKeyId : bedrockConfig.accessKeyId,
        secretAccessKey: inputBedrockConfig.secretAccessKey ? inputBedrockConfig.secretAccessKey : bedrockConfig.secretAccessKey,
        sessionToken: inputBedrockConfig.sessionToken ? inputBedrockConfig.sessionToken : bedrockConfig.sessionToken,
        region: inputBedrockConfig.region,
        personalDocumentLibraryKnowledgeBaseId: inputBedrockConfig.personalDocumentLibraryKnowledgeBaseId,
        dataSourceId: inputBedrockConfig.dataSourceId,
        s3BucketUri: inputBedrockConfig.s3BucketUri,
      };
    default:
      throw new Error('Invalid input config');
  }
}

/**
 * Checks if the given configuration object is valid.
 *
 * @param {any} config - The configuration object to validate.
 * @returns {boolean} - Returns `true` if any of the values in the configuration object are truthy, otherwise `false`.
 */
export function isValidBedrockConfig(config: any): boolean {
  for (const [_key, value] of Object.entries(config)) {
    if (value) {
      return true;
    }
  }

  return false;
}

