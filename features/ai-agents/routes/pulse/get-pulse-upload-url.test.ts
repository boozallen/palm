import db from '@/server/db';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import { getPulseUploadUrl } from './get-pulse-upload-url';
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
  getPulseUploadUrl,
});

describe('getPulseUploadUrl', () => {
  let mockCtx: ContextType;

  const mockInput = {
    agentId: '11111111-1111-1111-1111-111111111111',
    surveyFileName: 'symposium.xlsx',
  };

  const mockProvider = {
    id: 'provider-1',
    type: 'S3',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'user-1',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.PULSE },
    ]);

    (db.documentUploadProvider.findFirst as jest.Mock).mockResolvedValue(mockProvider);

    mockGeneratePresignedUploadUrl.mockResolvedValue({
      fileKey: 'uploads/symposium.xlsx',
      presignedUrl: 'https://example.test/upload',
    });
  });

  it('returns the upload target for the survey file', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.getPulseUploadUrl(mockInput);

    expect(result).toEqual({
      surveyFileKey: 'uploads/symposium.xlsx',
      surveyPresignedUrl: 'https://example.test/upload',
      documentUploadProviderId: 'provider-1',
    });
  });

  it('rejects an agent the user cannot access', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPulseUploadUrl(mockInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });

  it('rejects an agent of another type at the same id', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.agentId, type: AiAgentType.PRISM },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPulseUploadUrl(mockInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });

  it('explains that no upload provider is configured', async () => {
    (db.documentUploadProvider.findFirst as jest.Mock).mockResolvedValue(null);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.getPulseUploadUrl(mockInput)).rejects.toThrow(
      'No document upload provider configured',
    );
  });
});
