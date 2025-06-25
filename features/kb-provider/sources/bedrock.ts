import { z } from 'zod';
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  BedrockAgentClient,
  BedrockAgentServiceException,
  StartIngestionJobCommand,
  StartIngestionJobCommandOutput,
} from '@aws-sdk/client-bedrock-agent';
import {
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectCommandOutput,
  PutObjectCommand,
  PutObjectCommandInput,
  PutObjectCommandOutput, S3Client, S3ServiceException,
} from '@aws-sdk/client-s3';

import {
  KbSource,
  SearchInput,
  SearchResponse,
} from '@/features/kb-provider/sources/types';
import { kbProviderBedrockConfigSchema } from '@/features/shared/types';
import { UserDocumentMetadata, UserDocument } from '@/features/profile/types/document';

import { logger } from '@/server/logger';

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
  protected agentClient: BedrockAgentClient;
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
    this.agentClient = new BedrockAgentClient(buildConfig);
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
            // Removes the data source and folder, leaving only the file name
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

  async syncKnowledgeBase(description?: string): Promise<StartIngestionJobCommandOutput> {
    const { personalDocumentLibraryKnowledgeBaseId, dataSourceId } = this.config;

    if (!personalDocumentLibraryKnowledgeBaseId || !dataSourceId) {
      logger.error('Missing config required to sync knowledge base with S3 data source');
      throw new Error('Missing config required to sync knowledge base with S3 data source');
    }

    const command = new StartIngestionJobCommand({
      knowledgeBaseId: personalDocumentLibraryKnowledgeBaseId,
      dataSourceId: dataSourceId,
      description: description,
    });

    try {
      const response = await this.agentClient.send(command);
      return response;
    } catch (error) {
      if (error instanceof BedrockAgentServiceException) {
        logger.error('Error from BedrockAgentClient attempting to sync knowledge base', error);
        throw new Error('Error from BedrockAgentClient attempting to sync knowledge base');
      }
      logger.error('Error attempting to sync Bedrock knowledge base', error);
      throw new Error('Error attempting to sync Bedrock knowledge base');
    }
  }

  async deleteDocument(objectKey: string): Promise<boolean> {
    const s3Uri = this.config.s3BucketUri;
    if (!s3Uri) {
      logger.warn('Error with S3 config: missing S3 URI');
      throw new Error('Error getting S3 configuration');
    }
    const bucketName = s3Uri.split('/')[2]; // Extract bucket name from URI

    const client = new S3Client({
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        sessionToken: this.config.sessionToken,
      },
      region: this.config.region,
    });

    const input = {
      Bucket: bucketName,
      Key: objectKey, // The full filepath within the bucket
    };

    const command = new DeleteObjectCommand(input);

    try {
      const response: DeleteObjectCommandOutput = await client.send(command);
      if (response.$metadata.httpStatusCode === 204) {
        // Call syncKnowledgeBase to update the knowledge base
        await this.syncKnowledgeBase();
        return true;
      }
      return false;
    } catch (error) {
      if (error instanceof S3ServiceException) {
        logger.error('Error from S3 while deleting document: ', error);
        throw new Error('Error from S3 while deleting document');
      }
      logger.error('Error attempting to delete document from S3: ', error);
      throw new Error('Error attempting to delete document from S3');
    }
  }

  async getDocumentsMetadata(filePaths: string[]): Promise<UserDocumentMetadata[]> {
    const s3Uri = this.config.s3BucketUri;
    if (!s3Uri) {
      logger.warn('Error with S3 config: missing S3 URI');
      throw new Error('Error getting S3 configuration');
    }
    const bucketName = s3Uri.split('/')[2]; // Extract bucket name from URI

    const client = new S3Client({
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        sessionToken: this.config.sessionToken,
      },
      region: this.config.region,
    });

    try {
      // Retrieve metadata for each document
      const userDocuments = await Promise.all(filePaths.map(async (key) => {
        const command = new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        });
        const response = await client.send(command);
        return {
          filePath: key,
          fileSize: response.ContentLength ?? 0,
          dateUploaded: response.LastModified ?? new Date(), // Use LastModified as proxy for dateUploaded
          fileType: response.ContentType ?? '',
        };
      }));
      return userDocuments;
    } catch (error) {
      if (error instanceof S3ServiceException) {
        logger.error('Error from S3 while getting document metadata: ', error);
        throw new Error('Error from S3 while getting document metadata');
      }
      logger.error('Error retrieving document metadata from S3: ', error);
      throw new Error('Error retrieving document metadata from S3');
    }
  }

  async uploadPersonalDocuments(documents: UserDocument[], userId: string): Promise<PutObjectCommandOutput[]> {
    const { s3BucketUri } = this.config;
    if (!s3BucketUri) {
      logger.warn('Error with S3 config: missing S3 URI');
      throw new Error('Error getting S3 configuration');
    }
    const bucketName = s3BucketUri.split('/')[2]; // Extract bucket name from URI

    const s3Client = new S3Client({
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        sessionToken: this.config.sessionToken,
      },
      region: this.config.region,
    });

    const uploadDocument = async (document: UserDocument): Promise<PutObjectCommandOutput> => {
      const inputParams: PutObjectCommandInput = {
        Bucket: bucketName,
        Key: `${userId}/${document.key}`,
        Body: document.body,
        ContentType: document.contentType,
        Metadata: {
          userId: userId,
        },
      };

      try {
        const response: PutObjectCommandOutput = await s3Client.send(new PutObjectCommand(inputParams));
        return response;
      } catch (error) {
        if (error instanceof S3ServiceException) {
          logger.error('Error from S3 while uploading document: ', error);
          throw new Error('Error from S3 while uploading document');
        }
        logger.error('Error attempting to upload document to S3: ', error);
        throw new Error('Error attempting to upload document to S3');
      }
    };

    const results = await Promise.all(documents.map(uploadDocument));

    if (results.every(result => result.$metadata.httpStatusCode === 204)) {
      await this.syncKnowledgeBase();
    }
    return results;
  }
}
