import { AiProviderType, ProviderConfig } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';
import { Prisma, PrismaClient } from '@prisma/client';
import TransactionClient = Prisma.TransactionClient;

export type CreateProviderConfigInput = {
  config: Exclude<ProviderConfig, 'id'>;
}

export default async function createProviderConfig(input: CreateProviderConfigInput): Promise<ProviderConfig> {
  return createProviderConfigWithDB(db, input.config);
}

/**
 * Create a provider config with the given database connection or transaction
 * @param {PrismaClient} db
 * @param {Exclude<ProviderConfig, 'id'>}config
 */
export async function createProviderConfigWithDB(db: PrismaClient | TransactionClient, config: Exclude<ProviderConfig, 'id'>): Promise<ProviderConfig> {
  try {
    switch (config.type) {
      case AiProviderType.OpenAi: {
        const result = await db.apiConfigOpenAi.create({
          data: {
            apiKey: config.apiKey,
            orgKey: config.orgKey,
          },
        });

        return {
          id: result.id,
          type: AiProviderType.OpenAi,
          apiKey: result.apiKey,
          orgKey: result.orgKey,
        };
      }
      case AiProviderType.AzureOpenAi: {
        const result = await db.apiConfigAzureOpenAi.create({
          data: {
            apiKey: config.apiKey,
            apiEndpoint: config.apiEndpoint,
            deploymentId: config.deploymentId,
          },
        });

        return {
          id: result.id,
          type: AiProviderType.AzureOpenAi,
          apiKey: result.apiKey,
          apiEndpoint: result.apiEndpoint,
          deploymentId: result.deploymentId,
        };
      }
      case AiProviderType.Anthropic: {
        const result = await db.apiConfigAnthropic.create({
          data: {
            apiKey: config.apiKey,
          },
        });

        return {
          id: result.id,
          type: AiProviderType.Anthropic,
          apiKey: result.apiKey,
        };
      }
      case AiProviderType.Gemini: {
        const result = await db.apiConfigGemini.create({
          data: {
            apiKey: config.apiKey,
          },
        });

        return {
          id: result.id,
          type: AiProviderType.Gemini,
          apiKey: result.apiKey,
        };
      }

      case AiProviderType.Bedrock: {
        const result = await db.apiConfigBedrock.create({
          data: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            sessionToken: config.sessionToken ?? '',
            region: config.region,
          },
        });

        return {
          id: result.id,
          type: AiProviderType.Bedrock,
          accessKeyId: result.accessKeyId,
          secretAccessKey: result.secretAccessKey,
          sessionToken: result.sessionToken,
          region: result.region,
        };
      }
      default: {
        throw new Error('Invalid provider type');
      }
    }
  } catch (error) {
    logger.error('Error creating provider config', error);
    throw new Error('Error creating provider config');
  }
}
