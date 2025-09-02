import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider } from './types';
import { DocumentUploadProviderConfig } from '@/features/shared/types/document-upload-provider';
import { getConfig } from '@/server/config';
import { generateObjectKey } from '@/features/shared/utils/documentUploadHelpers';

export class AWSStorageProvider implements StorageProvider {
  private s3Client: S3Client;
  private bucketName: string;
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

    this.s3Client = new S3Client({
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
}
