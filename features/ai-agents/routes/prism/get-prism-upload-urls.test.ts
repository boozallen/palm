import db from '@/server/db';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import { getPrismUploadUrls } from './get-prism-upload-urls';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';

const mockGeneratePresignedUploadUrl = jest.fn();

jest.mock('@/features/document-upload-provider/factory', () => ({
  DocumentUploadFactory: jest.fn().mockImplementation(() => ({
    buildSource: jest.fn().mockResolvedValue({
      source: {
        generatePresignedUploadUrl: mockGeneratePresignedUploadUrl,
      },
    }),
  })),
}));

jest.mock('@/server/db', () => ({
  documentUploadProvider: {
    findFirst: jest.fn(),
  },
}));

jest.mock('@/features/shared/dal/getAvailableAgents');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;

const testRouter = router({
  getPrismUploadUrls,
});

describe('getPrismUploadUrls', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    requirementsFileName: 'requirements.xlsx',
    proposalFileName: 'proposal.pdf',
    proposalContentType: 'application/pdf',
  };

  const mockProvider = {
    id: 'provider-id-123',
    type: 'S3',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.PRISM },
    ]);

    (db.documentUploadProvider.findFirst as jest.Mock).mockResolvedValue(mockProvider);

    mockGeneratePresignedUploadUrl
      .mockResolvedValueOnce({
        fileKey: 'requirements-key',
        presignedUrl: 'https://s3.example.com/requirements-presigned',
      })
      .mockResolvedValueOnce({
        fileKey: 'proposal-key',
        presignedUrl: 'https://s3.example.com/proposal-presigned',
      });
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismUploadUrls(mockInput)).rejects.toThrow(
      'PRISM agent not found or access denied',
    );

    expect(db.documentUploadProvider.findFirst).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.RCAST },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismUploadUrls(mockInput)).rejects.toThrow(
      'PRISM agent not found or access denied',
    );
  });

  it('should throw if no document upload provider configured', async () => {
    (db.documentUploadProvider.findFirst as jest.Mock).mockResolvedValue(null);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPrismUploadUrls(mockInput)).rejects.toThrow(
      'No document upload provider configured',
    );
  });

  it('should generate presigned URLs for both files', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.getPrismUploadUrls(mockInput);

    expect(mockGeneratePresignedUploadUrl).toHaveBeenCalledTimes(2);
  });

  it('should return presigned URLs and file keys', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPrismUploadUrls(mockInput);

    expect(result).toEqual({
      requirementsFileKey: 'requirements-key',
      requirementsPresignedUrl: 'https://s3.example.com/requirements-presigned',
      proposalFileKey: 'proposal-key',
      proposalPresignedUrl: 'https://s3.example.com/proposal-presigned',
      documentUploadProviderId: mockProvider.id,
    });
  });

  it('should include provider id in response', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPrismUploadUrls(mockInput);

    expect(result.documentUploadProviderId).toBe(mockProvider.id);
  });
});
