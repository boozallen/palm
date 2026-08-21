import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  TranscriptionJob,
  TranscriptionJobStatus,
  LanguageCode,
  MediaFormat,
} from '@aws-sdk/client-transcribe';
import { StorageProvider } from './types';
import { DocumentUploadProviderConfig } from '@/features/shared/types/document-upload-provider';
import { getConfig } from '@/server/config';
import { generateObjectKey } from '@/features/shared/utils/documentUploadHelpers';
import { logger } from '@/server/logger';

export class AWSStorageProvider implements StorageProvider {
  private s3Client: S3Client;
  private transcribeClient: TranscribeClient;
  private bucketName: string;
  private region: string;
  private userIdSalt: string;
  constructor(providerConfig: DocumentUploadProviderConfig) {
    const envConfig = getConfig();

    this.userIdSalt = envConfig.documentUploadProvider.userIdSalt;

    const awsConfig = {
      region: providerConfig.region || envConfig.documentUploadProvider.aws.region,
      accessKeyId:
        providerConfig.accessKeyId || envConfig.documentUploadProvider.aws.accessKeyId,
      secretAccessKey:
        providerConfig.secretAccessKey || envConfig.documentUploadProvider.aws.secretAccessKey,
      sessionToken:
        providerConfig.sessionToken || envConfig.documentUploadProvider.aws.sessionToken,
    };

    this.region = awsConfig.region;

    this.s3Client = new S3Client({
      region: awsConfig.region,
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
        sessionToken: awsConfig.sessionToken || undefined,
      },
    });

    this.transcribeClient = new TranscribeClient({
      region: awsConfig.region,
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
        sessionToken: awsConfig.sessionToken || undefined,
      },
    });

    if (providerConfig.s3Uri) {
      this.bucketName = providerConfig.s3Uri.replace('s3://', '');
    } else {
      throw new Error(
        'S3 bucket name must be provided in provider config s3Uri'
      );
    }
  }

  async generatePresignedUploadUrl(
    fileName: string,
    contentType: string,
    userId: string
  ): Promise<{ presignedUrl: string; fileKey: string }> {

    if (!this.userIdSalt.length) {
      throw new Error('Environment variable USER_ID_SALT is required');
    }

    const fileKey = generateObjectKey(userId, this.userIdSalt, fileName);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: contentType,
      Metadata: {
        originalFileName: fileName,
        uploadedAt: new Date().toISOString(),
        userId: userId,
      },
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    return {
      presignedUrl,
      fileKey,
    };
  }

  async generateDownloadUrl(fileKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    return await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });
  }

  async fetchFile(fileKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    const response = await this.s3Client.send(command);

    if (response.Body) {
      const reader = await response.Body.transformToByteArray();
      return Buffer.from(reader);
    }

    throw new Error('No file content found');
  }

  async deleteFile(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    await this.s3Client.send(command);
  }

  getBucketName(): string {
    return this.bucketName;
  }

  private detectMediaFormat(fileName: string): MediaFormat {
    const lowerFileName = fileName.toLowerCase();
    if (lowerFileName.endsWith('.mp3')) {
      return MediaFormat.MP3;
    } else if (lowerFileName.endsWith('.m4a')) {
      return MediaFormat.M4A;
    } else if (lowerFileName.endsWith('.wav')) {
      return MediaFormat.WAV;
    }
    throw new Error(`Unsupported audio format for file: ${fileName}`);
  }

  async transcribeAudioFile(params: {
    fileKey: string;
    fileName: string;
    onProgress?: (progress: string) => Promise<void>;
  }): Promise<string> {
    const { fileKey, fileName, onProgress } = params;
    const jobName = `transcribe-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const mediaFormat = this.detectMediaFormat(fileName);
    const s3Uri = `s3://${this.bucketName}/${fileKey}`;

    logger.info(`Starting transcription for: ${fileName}`, {
      jobName,
      s3Uri,
      mediaFormat,
    });

    // Start transcription job
    const startCommand = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: LanguageCode.EN_US,
      MediaFormat: mediaFormat,
      Media: {
        MediaFileUri: s3Uri,
      },
    });

    try {
      await this.transcribeClient.send(startCommand);
      logger.info(`Transcription job started: ${jobName}`);
    } catch (error: any) {
      logger.error(`Failed to start transcription job: ${jobName}`, {
        message: error.message,
        code: error.code,
        statusCode: error.$metadata?.httpStatusCode,
      });
      throw error;
    }

    if (onProgress) {
      await onProgress('Transcription job started, waiting for completion...');
    }

    // Poll for completion
    const maxWaitTime = 600000; 
    const pollInterval = 5000; 
    const startTime = Date.now();

    while (true) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(`Transcription job ${jobName} timed out after ${maxWaitTime / 1000} seconds`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const getCommand = new GetTranscriptionJobCommand({
        TranscriptionJobName: jobName,
      });

      const response = await this.transcribeClient.send(getCommand);
      const job: TranscriptionJob | undefined = response.TranscriptionJob;

      if (!job) {
        throw new Error(`Transcription job ${jobName} not found`);
      }

      const status = job.TranscriptionJobStatus;
      logger.debug(`Transcription job ${jobName} status: ${status}`);

      if (status === TranscriptionJobStatus.COMPLETED) {
        logger.info(`Transcription job ${jobName} completed`);

        if (onProgress) {
          await onProgress('Transcription completed, fetching transcript...');
        }

        // Fetch the transcript
        const transcriptUri = job.Transcript?.TranscriptFileUri;
        if (!transcriptUri) {
          throw new Error(`No transcript URI found for job ${jobName}`);
        }

        const transcriptResponse = await fetch(transcriptUri);
        if (!transcriptResponse.ok) {
          throw new Error(`Failed to fetch transcript from ${transcriptUri}`);
        }

        const transcriptData = await transcriptResponse.json();
        const transcriptText = transcriptData.results?.transcripts?.[0]?.transcript;

        if (!transcriptText) {
          throw new Error(`No transcript text found in response for job ${jobName}`);
        }

        logger.info(`Successfully retrieved transcript for job ${jobName}`);
        return transcriptText;
      } else if (status === TranscriptionJobStatus.FAILED) {
        const failureReason = job.FailureReason || 'Unknown error';
        throw new Error(`Transcription job ${jobName} failed: ${failureReason}`);
      } else if (status === TranscriptionJobStatus.IN_PROGRESS) {
        if (onProgress) {
          await onProgress(`Transcription in progress... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);
        }
      }
    }
  }
}
