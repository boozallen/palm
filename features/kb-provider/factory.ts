import logger from '@/server/logger';
import {
  KbProvider,
  kbProviderBedrockConfigSchema,
  KbProviderType,
  KbProviderPalmConfigSchema,
  KnowledgeBase,
} from '@/features/shared/types';
import { KbSource, PalmKbApiSource } from './sources';
import getKnowledgeBaseAndProvider from './dal/getKnowledgeBaseAndProvider';
import { BedrockSource } from '@/features/kb-provider/sources/bedrock';
import { isValidBedrockConfig } from '@/features/kb-provider/sources/utils';
import { getConfig } from '@/server/config';

type BuildResult = {
  source: KbSource;
  provider: KbProvider;
  knowledgeBase: KnowledgeBase;
};

export interface KBFactoryConfig {
  userId: string;
}

export class KBFactory {
  constructor(protected config: KBFactoryConfig) {
    if (!this.config.userId) {
      logger.error('Missing required configuration properties: config.userId');
      throw new Error('Missing required configuration properties');
    }
  }

  async buildSource(knowledgeBaseId: string): Promise<BuildResult> {
    try {
      const knowledgeBaseAndProvider = await getKnowledgeBaseAndProvider(
        knowledgeBaseId
      );
      if (!knowledgeBaseAndProvider) {
        throw new Error(`Knowldge base ${knowledgeBaseId} does not exist`);
      }
      const source = this.buildClient(knowledgeBaseAndProvider.kbProvider);
      return {
        source,
        provider: knowledgeBaseAndProvider.kbProvider,
        knowledgeBase: knowledgeBaseAndProvider.knowledgeBase,
      };
    } catch (cause) {
      const msg = `Error building KB source for id ${knowledgeBaseId}`;
      logger.error(msg, cause);
      throw new Error(msg, { cause });
    }
  }

  private buildClient(kbProvider: KbProvider): KbSource {
    switch (kbProvider.kbProviderType) {
      case KbProviderType.KbProviderPalm:
        return new PalmKbApiSource(
          KbProviderPalmConfigSchema.parse(kbProvider.config)
        );
      case KbProviderType.KbProviderBedrock:
        const dbBedrockConfig = kbProviderBedrockConfigSchema.parse(
          kbProvider.config
        );
        return new BedrockSource(
          isValidBedrockConfig(dbBedrockConfig) ? dbBedrockConfig : getConfig().bedrock
        );
      default:
        throw new Error('Unimplemented provider source');
    }
  }
}
