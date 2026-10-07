import createAiProviderUsageRecord from './createAiProviderUsageRecord';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

const mockModelFindUnique = jest.fn();
const mockAiProvider = jest.fn();
const mockAiProviderUsage = jest.fn();

(db.$transaction as jest.Mock).mockImplementation(async (callback) => {
  return callback({
    model: { findUnique: mockModelFindUnique },
    aiProvider: { findUnique: mockAiProvider },
    aiProviderUsage: { create: mockAiProviderUsage },
  });
});

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('createAiProviderUsageRecord', () => {
  const testInput = {
    userId: 'user-id',
    modelId: 'model-id',
    inputTokensUsed: 100,
    outputTokensUsed: 200,
    system: false,
  };

  const mockDocumentId = '2f1c9e7a-5b3d-4c8e-9a1f-6d2b8c4e7a03';
  const dbResultMock = { id: 'recordid', timestamp: 1234 };
  const validInput = { ...testInput, userGroupId: 'group-1' };

  const mockUniqueModel = {
    aiProviderId: 'provider-id',
    costPerInputToken: 0.1,
    costPerOutputToken: 0.2,
    aiProvider: {
      costPerInputToken: 0.3,
      costPerOutputToken: 0.4,
    },
  };

  beforeEach(() => {
    mockModelFindUnique.mockResolvedValue(mockUniqueModel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not create a record when no user group is attributed', async () => {
    const createdRecord = await createAiProviderUsageRecord(testInput);

    expect(createdRecord).toBeNull();
    expect(mockAiProviderUsage).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('still throws when the model is not found, even with no user group attributed', async () => {
    mockModelFindUnique.mockResolvedValue(null);

    await expect(createAiProviderUsageRecord(testInput)).rejects.toThrow(
      'There was an error creating record for AI provider usage',
    );

    expect(logger.error).toHaveBeenCalled();
    expect(mockAiProviderUsage).not.toHaveBeenCalled();
  });

  it('creates an AI provider usage record', async () => {
    const expectedRecordInput = {
      userId: validInput.userId,
      modelId: validInput.modelId,
      aiProviderId: mockUniqueModel.aiProviderId,
      inputTokensUsed: validInput.inputTokensUsed,
      costPerInputToken: mockUniqueModel.costPerInputToken,
      outputTokensUsed: validInput.outputTokensUsed,
      costPerOutputToken: mockUniqueModel.costPerOutputToken,
      system: false,
      agent: false,
      knowledgeGraph: false,
      embedding: false,
      userGroupId: validInput.userGroupId,
    };

    const expectedRecord = {
      id: 'recordid',
      timestamp: 1234,
      ...expectedRecordInput,
    };

    mockAiProviderUsage.mockResolvedValue(expectedRecord);

    const createdRecord = await createAiProviderUsageRecord(validInput);

    expect(mockModelFindUnique).toHaveBeenCalledWith({
      where: { id: validInput.modelId },
      select: {
        aiProviderId: true,
        costPerInputToken: true,
        costPerOutputToken: true,
        aiProvider: {
          select: {
            costPerInputToken: true,
            costPerOutputToken: true,
          },
        },
      },
    });
    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expectedRecordInput,
    });
    expect(createdRecord).toEqual(expectedRecord);
  });

  it('persists the embedding flag when provided', async () => {
    mockAiProviderUsage.mockResolvedValue({ id: 'recordid', timestamp: 1234 });

    await createAiProviderUsageRecord({ ...validInput, embedding: true });

    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expect.objectContaining({ embedding: true }),
    });
  });

  it('persists chat message attribution when provided', async () => {
    mockAiProviderUsage.mockResolvedValue({ id: 'recordid', timestamp: 1234 });

    await createAiProviderUsageRecord({
      ...validInput,
      chatMessageId: 'message-1',
      stepLabel: 'response',
    });

    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chatMessageId: 'message-1',
        stepLabel: 'response',
      }),
    });
  });

  it('persists workflow primitive attribution when provided', async () => {
    mockAiProviderUsage.mockResolvedValue({ id: 'recordid', timestamp: 1234 });

    await createAiProviderUsageRecord({
      ...validInput,
      workflowExecutionId: 'exec-1',
      primitiveId: 'prompt-1',
      stepLabel: 'Draft',
    });

    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workflowExecutionId: 'exec-1',
        primitiveId: 'prompt-1',
        stepLabel: 'Draft',
      }),
    });
  });

  it('persists document attribution when provided', async () => {
    mockAiProviderUsage.mockResolvedValue({ id: 'recordid', timestamp: 1234 });

    await createAiProviderUsageRecord({
      ...validInput,
      documentId: 'document-1',
      stepLabel: 'ingestion',
    });

    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'document-1',
        stepLabel: 'ingestion',
      }),
    });
  });

  it('omits attribution columns entirely when no attribution is provided beyond the user group', async () => {
    mockAiProviderUsage.mockResolvedValue({ id: 'recordid', timestamp: 1234 });

    await createAiProviderUsageRecord(validInput);

    const { data } = mockAiProviderUsage.mock.calls[0][0];
    expect(data).not.toHaveProperty('chatMessageId');
    expect(data).not.toHaveProperty('workflowExecutionId');
    expect(data).not.toHaveProperty('primitiveId');
    expect(data).not.toHaveProperty('documentId');
    expect(data).not.toHaveProperty('stepLabel');
    expect(data.userGroupId).toBe(validInput.userGroupId);
  });

  it('returns the attribution columns on the created record', async () => {
    mockAiProviderUsage.mockResolvedValue({
      id: 'recordid',
      timestamp: 1234,
      chatMessageId: 'message-1',
      workflowExecutionId: null,
      primitiveId: null,
      stepLabel: 'response',
    });

    const createdRecord = await createAiProviderUsageRecord({
      ...validInput,
      chatMessageId: 'message-1',
      stepLabel: 'response',
    });

    expect(createdRecord?.chatMessageId).toBe('message-1');
    expect(createdRecord?.workflowExecutionId).toBeNull();
    expect(createdRecord?.primitiveId).toBeNull();
    expect(createdRecord?.stepLabel).toBe('response');
  });

  it('creates an AI provider usage record with model cost values', async () => {
    const expectedRecordInput = {
      userId: 'user-id',
      modelId: 'model-id',
      aiProviderId: 'provider-id',
      inputTokensUsed: 100,
      costPerInputToken: 0.1,
      outputTokensUsed: 200,
      costPerOutputToken: 0.2,
      system: false,
      agent: false,
      knowledgeGraph: false,
      embedding: false,
      userGroupId: 'group-1',
    };

    const expectedRecord = {
      id: 'recordid',
      timestamp: 1234,
      ...expectedRecordInput,
    };

    mockAiProviderUsage.mockResolvedValue(expectedRecord);

    const createdRecord = await createAiProviderUsageRecord(validInput);

    expect(mockModelFindUnique).toHaveBeenCalledWith({
      where: { id: validInput.modelId },
      select: {
        aiProviderId: true,
        costPerInputToken: true,
        costPerOutputToken: true,
        aiProvider: {
          select: {
            costPerInputToken: true,
            costPerOutputToken: true,
          },
        },
      },
    });
    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expectedRecordInput,
    });
    expect(createdRecord).toEqual(expectedRecord);
  });

  it('creates an AI provider usage record using provider values when model values are zero', async () => {
    mockModelFindUnique.mockResolvedValue({
      aiProviderId: 'provider-id',
      costPerInputToken: 0,
      costPerOutputToken: 0,
      aiProvider: {
        costPerInputToken: 0.3,
        costPerOutputToken: 0.4,
      },
    });

    const expectedRecordInput = {
      userId: 'user-id',
      modelId: 'model-id',
      aiProviderId: 'provider-id',
      inputTokensUsed: 100,
      costPerInputToken: 0.3,
      outputTokensUsed: 200,
      costPerOutputToken: 0.4,
      system: false,
      agent: false,
      knowledgeGraph: false,
      embedding: false,
      userGroupId: 'group-1',
    };

    const expectedRecord = {
      id: 'recordid',
      timestamp: 1234,
      ...expectedRecordInput,
    };

    mockAiProviderUsage.mockResolvedValue(expectedRecord);

    const createdRecord = await createAiProviderUsageRecord(validInput);

    expect(mockModelFindUnique).toHaveBeenCalledWith({
      where: { id: validInput.modelId },
      select: {
        aiProviderId: true,
        costPerInputToken: true,
        costPerOutputToken: true,
        aiProvider: {
          select: {
            costPerInputToken: true,
            costPerOutputToken: true,
          },
        },
      },
    });
    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expectedRecordInput,
    });
    expect(createdRecord).toEqual(expectedRecord);
  });

  it('should throw an error if the model is not found', async () => {
    mockModelFindUnique.mockResolvedValue(null);

    await expect(createAiProviderUsageRecord(validInput)).rejects.toThrow(
      'There was an error creating record for AI provider usage',
    );

    expect(logger.error).toHaveBeenCalled();
  });
  it('throws an error if there is a problem creating the record', async () => {
    mockAiProviderUsage.mockRejectedValueOnce(new Error('DB error'));

    await expect(createAiProviderUsageRecord(validInput)).rejects.toThrow(
      'There was an error creating record for AI provider usage',
    );
    expect(logger.error).toHaveBeenCalled();
  });

  // Ingestion spend has to name the document it embedded, or it cannot be
  // totalled per artifact later. Null means unattributed, not free.
  it('persists documentId when the caller supplies one', async () => {
    mockAiProviderUsage.mockResolvedValue({ ...dbResultMock, documentId: mockDocumentId });

    await createAiProviderUsageRecord({ ...validInput, documentId: mockDocumentId });

    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expect.objectContaining({ documentId: mockDocumentId }),
    });
  });

  it('omits documentId when the caller supplies none', async () => {
    mockAiProviderUsage.mockResolvedValue(dbResultMock);

    await createAiProviderUsageRecord(validInput);

    expect(mockAiProviderUsage).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ documentId: expect.anything() }),
    });
  });
});
