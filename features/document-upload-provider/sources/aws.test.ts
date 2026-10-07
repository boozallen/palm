import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TranscribeClient, TranscriptionJobStatus } from '@aws-sdk/client-transcribe';
import { AWSStorageProvider } from './aws';

import { getConfig } from '@/server/config';
import { generateObjectKey } from '@/features/shared/utils/documentUploadHelpers';
import { DocumentUploadProviderConfig, DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-transcribe');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('@/server/config');
jest.mock('@/features/shared/utils/documentUploadHelpers');
jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockS3Client = S3Client as jest.MockedClass<typeof S3Client>;
const mockTranscribeClient = TranscribeClient as jest.MockedClass<typeof TranscribeClient>;
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;
const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockGenerateObjectKey = generateObjectKey as jest.MockedFunction<typeof generateObjectKey>;

const mockSend = jest.fn();
const mockTranscribeSend = jest.fn();

describe('AWSStorageProvider', () => {
  const mockProviderConfig: DocumentUploadProviderConfig = {
    providerType: DocumentUploadProviderType.AWS,
    s3Uri: 's3://test-bucket',
    region: 'us-east-1',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    sessionToken: 'test-session-token',
  };

  const mockEnvConfig = {
    documentUploadProvider: {
      userIdSalt: 'test-salt',
      aws: {
        region: 'us-east-2',
        accessKeyId: 'env-access-key',
        secretAccessKey: 'env-secret-key',
        sessionToken: 'env-session-token',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetConfig.mockReturnValue(mockEnvConfig as any);
    mockGenerateObjectKey.mockReturnValue('test-file-key');

    mockS3Client.mockImplementation(() => ({
      send: mockSend,
    }) as any);

    mockTranscribeClient.mockImplementation(() => ({
      send: mockTranscribeSend,
    }) as any);
  });

  describe('constructor', () => {
    it('should initialize with provider config values', () => {
      const _provider = new AWSStorageProvider(mockProviderConfig);
      
      expect(mockS3Client).toHaveBeenCalledWith({
        region: mockProviderConfig.region,
        credentials: {
          accessKeyId: mockProviderConfig.accessKeyId,
          secretAccessKey: mockProviderConfig.secretAccessKey,
          sessionToken: mockProviderConfig.sessionToken,
        },
      });
    });

    it('should fallback to environment config when provider config is not provided', () => {
      const configWithEmptyCredentials: DocumentUploadProviderConfig = { 
        providerType: DocumentUploadProviderType.AWS,
        s3Uri: 's3://test-bucket',
        accessKeyId: '',
        secretAccessKey: '',
        region: '',
      };

      const _provider = new AWSStorageProvider(configWithEmptyCredentials);

      expect(mockS3Client).toHaveBeenCalledWith({
        region: mockEnvConfig.documentUploadProvider.aws.region,
        credentials: {
          accessKeyId: mockEnvConfig.documentUploadProvider.aws.accessKeyId,
          secretAccessKey: mockEnvConfig.documentUploadProvider.aws.secretAccessKey,
          sessionToken: mockEnvConfig.documentUploadProvider.aws.sessionToken,
        },
      });
    });

    it('should set sessionToken to undefined when not provided in config but present in env', () => {
      const configWithoutSessionToken: DocumentUploadProviderConfig = {
        providerType: DocumentUploadProviderType.AWS,
        s3Uri: 's3://test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      };
      
      const _provider = new AWSStorageProvider(configWithoutSessionToken);
      
      expect(mockS3Client).toHaveBeenCalledWith({
        region: configWithoutSessionToken.region,
        credentials: {
          accessKeyId: configWithoutSessionToken.accessKeyId,
          secretAccessKey: configWithoutSessionToken.secretAccessKey,
          sessionToken: mockEnvConfig.documentUploadProvider.aws.sessionToken,
        },
      });
    });

    it('should throw an error if s3Uri is not provided', () => {
      const configWithoutS3Uri = {
        providerType: DocumentUploadProviderType.AWS,
        region: 'us-east-1',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        s3Uri: '',
      } as DocumentUploadProviderConfig;
      
      expect(() => new AWSStorageProvider(configWithoutS3Uri)).toThrow(
        'S3 bucket name must be provided in provider config s3Uri'
      );
    });
  });

  describe('generatePresignedUploadUrl', () => {
    let provider: AWSStorageProvider;

    beforeEach(() => {
      provider = new AWSStorageProvider(mockProviderConfig);
    });

    it('should generate presigned upload URL with correct parameters', async () => {
      const mockPresignedUrl = 'https://test-bucket.s3.amazonaws.com/presigned-url';
      mockGetSignedUrl.mockResolvedValue(mockPresignedUrl);

      const result = await provider.generatePresignedUploadUrl(
        'test-file.pdf',
        'application/pdf',
        'user123'
      );

      expect(mockGenerateObjectKey).toHaveBeenCalledWith(
        'user123',
        'test-salt',
        'test-file.pdf'
      );

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), 
        expect.any(Object), 
        { expiresIn: 3600 }
      );

      expect(result).toEqual({
        presignedUrl: mockPresignedUrl,
        fileKey: 'test-file-key',
      });
    });

    it('should throw an error if userIdSalt is empty', async () => {
      mockGetConfig.mockReturnValue({
        documentUploadProvider: {
          userIdSalt: '',
          aws: mockEnvConfig.documentUploadProvider.aws,
        },
      } as any);

      const provider = new AWSStorageProvider(mockProviderConfig);

      await expect(
        provider.generatePresignedUploadUrl('test-file.pdf', 'application/pdf', 'user123')
      ).rejects.toThrow('Environment variable USER_ID_SALT is required');
    });

    it('should handle errors from AWS SDK', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('AWS SDK error'));

      await expect(
        provider.generatePresignedUploadUrl('test-file.pdf', 'application/pdf', 'user123')
      ).rejects.toThrow('AWS SDK error');
    });
  });

  describe('generateDownloadUrl', () => {
    let provider: AWSStorageProvider;

    beforeEach(() => {
      provider = new AWSStorageProvider(mockProviderConfig);
    });

    it('should generate download URL with correct parameters', async () => {
      const mockDownloadUrl = 'https://test-bucket.s3.amazonaws.com/download-url';
      mockGetSignedUrl.mockResolvedValue(mockDownloadUrl);

      const result = await provider.generateDownloadUrl('test-file-key');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), 
        expect.any(Object), 
        { expiresIn: 3600 }
      );

      expect(result).toBe(mockDownloadUrl);
    });

    it('should handle errors from AWS SDK', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('AWS SDK error'));

      await expect(provider.generateDownloadUrl('test-file-key')).rejects.toThrow(
        'AWS SDK error'
      );
    });
  });

  describe('fetchFile', () => {
    let provider: AWSStorageProvider;

    beforeEach(() => {
      provider = new AWSStorageProvider(mockProviderConfig);
    });

    it('should fetch file and return Buffer', async () => {
      const mockFileContent = new Uint8Array([1, 2, 3, 4, 5]);
      const mockResponse = {
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(mockFileContent),
        },
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await provider.fetchFile('test-file-key');

      expect(mockSend).toHaveBeenCalledWith(expect.any(Object)); 

      expect(result).toEqual(Buffer.from(mockFileContent));
    });

    it('should throw an error if no file content is found', async () => {
      const mockResponse = {
        Body: null,
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(provider.fetchFile('test-file-key')).rejects.toThrow(
        'No file content found'
      );
    });

    it('should handle errors from AWS SDK', async () => {
      mockSend.mockRejectedValue(new Error('AWS SDK error'));

      await expect(provider.fetchFile('test-file-key')).rejects.toThrow('AWS SDK error');
    });
  });

  describe('deleteFile', () => {
    let provider: AWSStorageProvider;

    beforeEach(() => {
      provider = new AWSStorageProvider(mockProviderConfig);
    });

    it('should delete file with correct parameters', async () => {
      mockSend.mockResolvedValue({});

      await provider.deleteFile('test-file-key');

      expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should handle errors from AWS SDK', async () => {
      mockSend.mockRejectedValue(new Error('AWS SDK error'));

      await expect(provider.deleteFile('test-file-key')).rejects.toThrow('AWS SDK error');
    });
  });

  describe('getBucketName', () => {
    it('should return the bucket name', () => {
      const provider = new AWSStorageProvider(mockProviderConfig);

      expect(provider.getBucketName()).toBe('test-bucket');
    });
  });

  describe('transcribeAudioFile', () => {
    let provider: AWSStorageProvider;

    beforeEach(() => {
      provider = new AWSStorageProvider(mockProviderConfig);
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should successfully transcribe an mp3 file', async () => {
      const mockTranscript = 'This is the transcribed text from the audio file.';

      // Mock StartTranscriptionJob response
      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      // Mock GetTranscriptionJob responses - first in progress, then completed
      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {
            TranscriptFileUri: 'https://s3.amazonaws.com/transcript.json',
          },
        },
      });

      // Mock fetch for transcript file
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: {
            transcripts: [{ transcript: mockTranscript }],
          },
        }),
      });

      const transcribePromise = provider.transcribeAudioFile({
        fileKey: 'test-audio.mp3',
        fileName: 'test-audio.mp3',
      });

      // Advance timers to trigger polling
      await jest.advanceTimersByTimeAsync(5000);
      await jest.advanceTimersByTimeAsync(5000);

      const result = await transcribePromise;

      expect(result).toBe(mockTranscript);
      expect(mockTranscribeSend).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenCalledWith('https://s3.amazonaws.com/transcript.json');
    });

    it('should successfully transcribe an m4a file', async () => {
      const mockTranscript = 'This is transcribed from m4a.';

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {
            TranscriptFileUri: 'https://s3.amazonaws.com/transcript.json',
          },
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: {
            transcripts: [{ transcript: mockTranscript }],
          },
        }),
      });

      const transcribePromise = provider.transcribeAudioFile({
        fileKey: 'test-audio.m4a',
        fileName: 'test-audio.m4a',
      });

      await jest.advanceTimersByTimeAsync(5000);

      const result = await transcribePromise;

      expect(result).toBe(mockTranscript);
    });

    it('should successfully transcribe a wav file', async () => {
      const mockTranscript = 'This is transcribed from wav.';

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {
            TranscriptFileUri: 'https://s3.amazonaws.com/transcript.json',
          },
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: {
            transcripts: [{ transcript: mockTranscript }],
          },
        }),
      });

      const transcribePromise = provider.transcribeAudioFile({
        fileKey: 'test-audio.wav',
        fileName: 'test-audio.wav',
      });

      await jest.advanceTimersByTimeAsync(5000);

      const result = await transcribePromise;

      expect(result).toBe(mockTranscript);
    });

    it('should call onProgress callback during transcription', async () => {
      const onProgress = jest.fn();
      const mockTranscript = 'Transcribed text';

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {
            TranscriptFileUri: 'https://s3.amazonaws.com/transcript.json',
          },
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: {
            transcripts: [{ transcript: mockTranscript }],
          },
        }),
      });

      const transcribePromise = provider.transcribeAudioFile({
        fileKey: 'test-audio.mp3',
        fileName: 'test-audio.mp3',
        onProgress,
      });

      await jest.advanceTimersByTimeAsync(5000);
      await jest.advanceTimersByTimeAsync(5000);

      await transcribePromise;

      expect(onProgress).toHaveBeenCalledWith('Transcription job started, waiting for completion...');
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Transcription in progress'));
      expect(onProgress).toHaveBeenCalledWith('Transcription completed, fetching transcript...');
    });

    it('should throw error for unsupported audio format', async () => {
      await expect(
        provider.transcribeAudioFile({
          fileKey: 'test-audio.ogg',
          fileName: 'test-audio.ogg',
        })
      ).rejects.toThrow('Unsupported audio format for file: test-audio.ogg');
    });

    it('should handle failed transcription job', async () => {
      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.FAILED,
          FailureReason: 'Invalid audio file',
        },
      });

      const transcribePromise = provider.transcribeAudioFile({
        fileKey: 'test-audio.mp3',
        fileName: 'test-audio.mp3',
      });

      // Capture the promise rejection expectation first
      const expectation = expect(transcribePromise).rejects.toThrow('Invalid audio file');

      await jest.advanceTimersByTimeAsync(5000);

      await expectation;
    });

    it('should throw error when transcription job times out', async () => {
      mockTranscribeSend.mockResolvedValue({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      const transcribePromise = provider.transcribeAudioFile({
        fileKey: 'test-audio.mp3',
        fileName: 'test-audio.mp3',
      });

      // Capture the promise rejection expectation first
      const expectation = expect(transcribePromise).rejects.toThrow('timed out');

      // Advance past the 10 minute timeout in smaller chunks to avoid Jest timeout
      for (let i = 0; i < 121; i++) {
        await jest.advanceTimersByTimeAsync(5000);
      }

      await expectation;
    }, 15000); // Increase timeout for this test to 15 seconds

    it('should throw error when transcript URI is not found', async () => {
      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {},
        },
      });

      const transcribePromise = provider.transcribeAudioFile({
        fileKey: 'test-audio.mp3',
        fileName: 'test-audio.mp3',
      });

      // Capture the promise rejection expectation first
      const expectation = expect(transcribePromise).rejects.toThrow('No transcript URI found');

      await jest.advanceTimersByTimeAsync(5000);

      await expectation;
    });

    it('should throw error when transcript fetch fails', async () => {
      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {
            TranscriptFileUri: 'https://s3.amazonaws.com/transcript.json',
          },
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      });

      const transcribePromise = provider.transcribeAudioFile({
        fileKey: 'test-audio.mp3',
        fileName: 'test-audio.mp3',
      });

      // Capture the promise rejection expectation first
      const expectation = expect(transcribePromise).rejects.toThrow('Failed to fetch transcript');

      await jest.advanceTimersByTimeAsync(5000);

      await expectation;
    });

    it('should throw error when transcript text is not found in response', async () => {
      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.IN_PROGRESS,
        },
      });

      mockTranscribeSend.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: TranscriptionJobStatus.COMPLETED,
          Transcript: {
            TranscriptFileUri: 'https://s3.amazonaws.com/transcript.json',
          },
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: {
            transcripts: [],
          },
        }),
      });

      const transcribePromise = provider.transcribeAudioFile({
        fileKey: 'test-audio.mp3',
        fileName: 'test-audio.mp3',
      });

      // Capture the promise rejection expectation first
      const expectation = expect(transcribePromise).rejects.toThrow('No transcript text found in response');

      await jest.advanceTimersByTimeAsync(5000);

      await expectation;
    });

    it('should handle AWS SDK errors during transcription start', async () => {
      mockTranscribeSend.mockRejectedValueOnce(new Error('AWS Transcribe service unavailable'));

      await expect(
        provider.transcribeAudioFile({
          fileKey: 'test-audio.mp3',
          fileName: 'test-audio.mp3',
        })
      ).rejects.toThrow('AWS Transcribe service unavailable');
    });
  });
});
