import { z } from 'zod';

import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  KbSource,
  SearchInput,
  SearchResponse,
} from '@/features/kb-provider/sources/types';
import { kbProviderBedrockConfigSchema } from '@/features/shared/types';

export type kbProviderBedrockConfig = z.infer<
  typeof kbProviderBedrockConfigSchema
>;

// https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_Retrieve.html
const SearchResponseSchema = z.object({
  nextToken: z.string().optional(),
  retrievalResults: z.array(
    z.object({
      content: z.object({
        text: z.string(),
      }),
      location: z.object({
        confluenceLocation: z.object({
          url: z.string(),
        }).optional(),
        s3Location: z.object({
          uri: z.string(),
        }).optional(),
        salesForceLocation: z.object({
          url: z.string(),
        }).optional(),
        type: z.string(),
        webLocation: z.object({
          url: z.string(),
        }).optional(),
      }).optional(),
      metadata: z.object({
        'x-amz-bedrock-kb-document-page-number': z.number().optional(),
        'x-amz-bedrock-kb-source-uri': z.string().optional(),
      }).optional(),
      score: z.number().optional(),
    })
  ),
});

export class BedrockSource implements KbSource {
  protected agentRuntimeClient: BedrockAgentRuntimeClient;

  constructor(protected config: kbProviderBedrockConfig) {
    if (!config?.accessKeyId || !config?.secretAccessKey) {
      throw new Error('Invalid or missing parameters for Kb Provider');
    }

    const buildConfig = {
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      },
      region: config.region,
    };

    this.agentRuntimeClient = new BedrockAgentRuntimeClient(buildConfig);
  }

  async search(input: SearchInput): Promise<SearchResponse> {
    const command = new RetrieveCommand({
      knowledgeBaseId: input.knowledgeBaseId,
      retrievalQuery: {
        text: input.message,
      },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: Number(input.maxResults),
        },
      },
    });

    const response = await this.agentRuntimeClient.send(command);

    const { retrievalResults } = SearchResponseSchema.parse(response);

    const formattedOutput: SearchResponse = {
      results: retrievalResults
        .filter((result) => !input.minScore || (result.score && result.score >= input.minScore))
        .map((result) => {
          const page = result.metadata?.['x-amz-bedrock-kb-document-page-number'];
          let source = result.metadata?.['x-amz-bedrock-kb-source-uri'];

          if (source) {
            const nItems = source.split('/').length;
            source = source.split('/')[nItems - 1];
          }

          let metaData = source && source.length > 0 ? `(${source}` : '';

          if (page) {
            metaData += `, p. ${page}`;
          }

          metaData += `): ${result.content.text}`;

          return {
            content: result.content.text,
            score: result.score ?? 0,
            citation: {
              label: metaData,
              knowledgeBaseId: input.knowledgeBaseId,
            },
          };
        }),
    };

    return formattedOutput;
  }
}
