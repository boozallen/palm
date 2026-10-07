import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import uploadRateCard from './upload-rate-card';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import createRateCard from '@/features/ai-agents/dal/rcast/createRateCard';
import { parseRateCard } from '@/features/ai-agents/utils/rcast/parseRateCard';
import isUserGroupMember from '@/features/shared/dal/isUserGroupMember';
import { AiAgentType } from '@/features/shared/types';

jest.mock('uuid', () => {
  const actualUuid = jest.requireActual('uuid');
  return {
    ...actualUuid,
    v4: jest.fn().mockReturnValue('mock-job-id'),
  };
});

const mockAdd = jest.fn();

jest.mock('@/features/ai-agents/utils/rcast/worker/queue', () => ({
  getRcastQueue: () => ({
    add: mockAdd,
  }),
}));

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/dal/rcast/createRateCard');
jest.mock('@/features/ai-agents/utils/rcast/parseRateCard');
jest.mock('@/features/shared/dal/isUserGroupMember');

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockCreateRateCard = createRateCard as jest.Mock;
const mockParseRateCard = parseRateCard as jest.Mock;
const mockIsUserGroupMember = isUserGroupMember as jest.Mock;

const testRouter = router({
  uploadRateCard,
});

describe('uploadRateCard (rcast)', () => {
  let mockCtx: ContextType;

  const mockInput = {
    aiAgentId: '7365c7c3-d10f-48cb-bfbc-0c2566f29599',
    fileContent: Buffer.from('mock excel content').toString('base64'),
    fileName: 'test-rate-card.xlsx',
    modelId: 'test-model-id',
  };

  const mockParsedRows = [
    {
      laborCategory: 'Software Engineer',
      experienceLevel: 'Senior',
      rate: 150.0,
    },
    {
      laborCategory: 'Data Scientist',
      experienceLevel: 'Mid-Level',
      rate: 125.0,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      logger: console,
    } as unknown as ContextType;

    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.aiAgentId, type: AiAgentType.RCAST },
    ]);
    mockParseRateCard.mockResolvedValue(mockParsedRows);
    mockCreateRateCard.mockResolvedValue({
      rateCardId: '885df193-100b-4d61-890c-7d563da8af12',
      successCount: 2,
      failureCount: 0,
    });
    mockIsUserGroupMember.mockResolvedValue(true);
  });

  it('should throw if agent is not available to user', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.uploadRateCard(mockInput)).rejects.toThrow(
      'RCAST-TWO agent not found'
    );

    expect(mockParseRateCard).not.toHaveBeenCalled();
    expect(mockCreateRateCard).not.toHaveBeenCalled();
  });

  it('should throw if agent is wrong type', async () => {
    mockGetAvailableAgents.mockResolvedValue([
      { id: mockInput.aiAgentId, type: AiAgentType.CERTA },
    ]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.uploadRateCard(mockInput)).rejects.toThrow(
      'RCAST-TWO agent not found'
    );
  });

  it('should parse the file', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.uploadRateCard(mockInput);

    expect(mockParseRateCard).toHaveBeenCalledWith(
      Buffer.from(mockInput.fileContent, 'base64'),
      mockInput.fileName
    );
  });

  it('should throw if parsing fails', async () => {
    mockParseRateCard.mockRejectedValue(new Error('Invalid file format'));

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.uploadRateCard(mockInput)).rejects.toThrow(
      'Invalid file format'
    );

    expect(mockCreateRateCard).not.toHaveBeenCalled();
  });

  it('should throw if no valid data found', async () => {
    mockParseRateCard.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.uploadRateCard(mockInput)).rejects.toThrow(
      'No valid data found in file.'
    );

    expect(mockCreateRateCard).not.toHaveBeenCalled();
  });

  it('should create rate card with parsed data', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.uploadRateCard(mockInput);

    expect(mockCreateRateCard).toHaveBeenCalledWith({
      aiAgentId: mockInput.aiAgentId,
      userId: mockCtx.userId,
      fileName: mockInput.fileName,
      parsedRows: mockParsedRows,
      userGroupId: null,
    });
  });

  it('should queue worker job with rcastJob name', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.uploadRateCard(mockInput);

    expect(mockAdd).toHaveBeenCalledWith('rcastJob', {
      jobId: 'mock-job-id',
      userId: mockCtx.userId,
      agentId: mockInput.aiAgentId,
      rateCardId: '885df193-100b-4d61-890c-7d563da8af12',
      modelId: mockInput.modelId,
      userGroupId: null,
    });
  });

  it('should return rate card id and job id', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.uploadRateCard(mockInput);

    expect(result).toEqual({
      rateCardId: '885df193-100b-4d61-890c-7d563da8af12',
      jobId: 'mock-job-id',
      message:
        'Rate card "test-rate-card.xlsx" uploaded successfully. Processed 2 labor categories. Background processing has been queued.',
    });
  });

  it('should include failure count in message if there are failures', async () => {
    mockCreateRateCard.mockResolvedValue({
      rateCardId: '885df193-100b-4d61-890c-7d563da8af12',
      successCount: 1,
      failureCount: 1,
    });

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.uploadRateCard(mockInput);

    expect(result.message).toContain('(1 failed)');
  });

  it('should not fail upload if queue job fails', async () => {
    mockAdd.mockRejectedValue(new Error('Queue error'));

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.uploadRateCard(mockInput);

    expect(result).toEqual({
      rateCardId: '885df193-100b-4d61-890c-7d563da8af12',
      jobId: undefined,
      message:
        'Rate card "test-rate-card.xlsx" uploaded successfully. Processed 2 labor categories. Background processing has been queued.',
    });
  });

  describe('group attribution', () => {
    const mockUserGroupId = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

    it('should validate membership and persist the group when userGroupId is provided', async () => {
      const caller = testRouter.createCaller(mockCtx);

      await caller.uploadRateCard({ ...mockInput, userGroupId: mockUserGroupId });

      expect(mockIsUserGroupMember).toHaveBeenCalledWith(mockCtx.userId, mockUserGroupId);
      expect(mockCreateRateCard).toHaveBeenCalledWith(
        expect.objectContaining({ userGroupId: mockUserGroupId })
      );
      expect(mockAdd).toHaveBeenCalledWith(
        'rcastJob',
        expect.objectContaining({ userGroupId: mockUserGroupId })
      );
    });

    it('should throw Forbidden if the user is not a member of the selected group', async () => {
      mockIsUserGroupMember.mockResolvedValue(false);

      const caller = testRouter.createCaller(mockCtx);

      await expect(
        caller.uploadRateCard({ ...mockInput, userGroupId: mockUserGroupId })
      ).rejects.toThrow('You are not a member of the selected group');

      expect(mockCreateRateCard).not.toHaveBeenCalled();
    });
  });
});
