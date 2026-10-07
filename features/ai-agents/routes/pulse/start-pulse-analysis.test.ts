import { storage } from '@/server/storage/redis';
import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import startPulseAnalysis from './start-pulse-analysis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import getAvailableModels from '@/features/shared/dal/getAvailableModels';
import createPulseJob from '@/features/ai-agents/dal/pulse/createPulseJob';
import { AiAgentType } from '@/features/shared/types';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import {
  formatPulseError,
  queueUnavailableError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';

jest.mock('uuid', () => {
  const actualUuid = jest.requireActual('uuid');
  return {
    ...actualUuid,
    v4: jest.fn().mockReturnValue('mock-job-id'),
  };
});

const mockAdd = jest.fn();

jest.mock('@/features/ai-agents/utils/pulse/worker/queue');

jest.mock('@/server/storage/redis', () => ({
  storage: {
    hset: jest.fn(),
  },
}));

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/shared/dal/getAvailableModels');
jest.mock('@/features/ai-agents/dal/pulse/createPulseJob');
jest.mock('@/features/shared/services/resolveUserGroupId', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(null),
}));

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockGetAvailableModels = getAvailableModels as jest.Mock;
const mockCreatePulseJob = createPulseJob as jest.Mock;

// Import after mocking to get the mocked version
const { getPulseQueue } = require('@/features/ai-agents/utils/pulse/worker/queue');
const mockGetPulseQueue = getPulseQueue as jest.Mock;

const testRouter = router({
  startPulseAnalysis,
});

describe('startPulseAnalysis', () => {
  let mockCtx: ContextType;

  const sentiment = {
    fieldName: 'Sentiment',
    prompt: 'Judge sentiment.',
    fieldType: PulseFieldType.CATEGORY,
    allowedValues: ['Positive', 'Negative'],
    defaultValue: MATRIX_FALLBACK_VALUE,
    inputColumnRefs: [],
    sortOrder: 0,
  };

  const mockInput = {
    agentId: '11111111-1111-1111-1111-111111111111',
    surveyFileKey: 'uploads/symposium.xlsx',
    surveyFileName: 'symposium.xlsx',
    documentUploadProviderId: '22222222-2222-2222-2222-222222222222',
    modelId: 'claude-opus-5',
    persona: 'You are a survey analyst.',
    resultsFocus: null,
    sheetName: 'Feedback',
    headerRow: 1,
    inputColumns: ['B', 'C'],
    responseCount: 120,
    fields: [sentiment],
    userGroupId: null,
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
    mockGetAvailableModels.mockResolvedValue([
      { id: 'claude-opus-5', name: 'Opus 5', providerLabel: 'Anthropic' },
    ]);
    mockCreatePulseJob.mockResolvedValue({ id: 'mock-job-id' });
    (storage.hset as jest.Mock).mockResolvedValue(1);
    mockAdd.mockResolvedValue({});
    mockGetPulseQueue.mockReturnValue({ add: mockAdd });
  });

  it('stores the field matrix with the job and queues the file', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.startPulseAnalysis(mockInput);

    expect(mockCreatePulseJob).toHaveBeenCalledWith(
      expect.objectContaining({ fields: [sentiment], sheetName: 'Feedback' }),
    );
    expect(mockAdd).toHaveBeenCalledWith('pulseJob', expect.objectContaining({
      surveyFileKey: 'uploads/symposium.xlsx',
      modelId: 'claude-opus-5',
    }));
  });

  it('says how many responses are waiting while the job sits in the queue', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.startPulseAnalysis(mockInput);

    expect(storage.hset).toHaveBeenCalledWith(
      expect.stringMatching(/^pulse-job:/),
      expect.objectContaining({
        progress: 'Job queued, waiting to start on 120 responses...',
      }),
    );
  });

  it('returns the job id the frontend polls', async () => {
    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.startPulseAnalysis(mockInput);

    expect(result).toMatchObject({ jobId: expect.any(String) });
  });

  it('starts a run from the persona and prompt matrix alone', async () => {
    const caller = testRouter.createCaller(mockCtx);

    await caller.startPulseAnalysis(mockInput);

    expect(mockCreatePulseJob.mock.calls[0][0]).not.toHaveProperty('responseGuidelines');
  });

  it('records the model the run used by id and name', async () => {
    await testRouter.createCaller(mockCtx).startPulseAnalysis(mockInput);

    expect(mockCreatePulseJob).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'claude-opus-5',
      modelName: 'Opus 5',
    }));
  });

  it('still starts a run whose model name cannot be looked up', async () => {
    mockGetAvailableModels.mockResolvedValue([]);

    await testRouter.createCaller(mockCtx).startPulseAnalysis(mockInput);

    expect(mockCreatePulseJob).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'claude-opus-5',
      modelName: null,
    }));
  });

  it('stores the results focus with the run', async () => {
    await testRouter.createCaller(mockCtx).startPulseAnalysis({
      ...mockInput,
      resultsFocus: '  Compare the regions.  ',
    });

    expect(mockCreatePulseJob).toHaveBeenCalledWith(expect.objectContaining({
      resultsFocus: 'Compare the regions.',
    }));
  });

  it('stores a blank results focus as none', async () => {
    await testRouter.createCaller(mockCtx).startPulseAnalysis({ ...mockInput, resultsFocus: '   ' });

    expect(mockCreatePulseJob).toHaveBeenCalledWith(expect.objectContaining({ resultsFocus: null }));
  });

  it('rejects a results focus over 1,000 characters', async () => {
    await expect(
      testRouter.createCaller(mockCtx).startPulseAnalysis({ ...mockInput, resultsFocus: 'x'.repeat(1001) }),
    ).rejects.toThrow();
    expect(mockCreatePulseJob).not.toHaveBeenCalled();
  });

  it('rejects an agent the user cannot access', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startPulseAnalysis(mockInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });

  it('rejects duplicate output column names', async () => {
    const input = { ...mockInput, fields: [sentiment, { ...sentiment, sortOrder: 1 }] };

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startPulseAnalysis(input)).rejects.toThrow(/distinct name/);
  });

  it('stores a padded column name trimmed, so the whole column does not default', async () => {
    const input = { ...mockInput, fields: [{ ...sentiment, fieldName: 'Sentiment ' }] };

    const caller = testRouter.createCaller(mockCtx);

    await caller.startPulseAnalysis(input);

    expect(mockCreatePulseJob).toHaveBeenCalledWith(
      expect.objectContaining({ fields: [expect.objectContaining({ fieldName: 'Sentiment' })] }),
    );
  });

  it('rejects a category column with no allowed values', async () => {
    const input = {
      ...mockInput,
      fields: [{ ...sentiment, allowedValues: [], defaultValue: null }],
    };

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startPulseAnalysis(input)).rejects.toThrow(/at least one allowed value/);
  });

  it('accepts a fallback that is not one of the allowed values', async () => {
    const input = {
      ...mockInput,
      fields: [{
        ...sentiment,
        allowedValues: ['Positive', 'Negative'],
        defaultValue: MATRIX_FALLBACK_VALUE,
      }],
    };

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startPulseAnalysis(input)).resolves.toEqual(
      expect.objectContaining({ jobId: expect.any(String) }),
    );
  });

  it('rejects a fallback that is one of the allowed values', async () => {
    const input = {
      ...mockInput,
      fields: [{
        ...sentiment,
        allowedValues: ['Positive', 'Negative'],
        defaultValue: 'Negative',
      }],
    };

    const caller = testRouter.createCaller(mockCtx);

    // The issue message arrives JSON-encoded, so its double quotes read as \".
    await expect(caller.startPulseAnalysis(input)).rejects.toThrow(
      /'Sentiment' lists .{1,2}Negative.{1,2} as an allowed value/,
    );
  });

  it('rejects a fallback that matches an allowed value in a different case', async () => {
    const input = {
      ...mockInput,
      fields: [{
        ...sentiment,
        allowedValues: ['Positive', 'Negative'],
        defaultValue: 'negative',
      }],
    };

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startPulseAnalysis(input)).rejects.toThrow(
      /'Sentiment' lists .{1,2}negative.{1,2} as an allowed value/,
    );
  });

  it('rejects a column reference outside the input columns', async () => {
    const input = { ...mockInput, fields: [{ ...sentiment, inputColumnRefs: ['Z'] }] };

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startPulseAnalysis(input)).rejects.toThrow(/'Z' doesn't match any survey column/);
  });

  it('names the columns the run does read when a reference falls outside them', async () => {
    const input = { ...mockInput, fields: [{ ...sentiment, inputColumnRefs: ['Z'] }] };

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startPulseAnalysis(input)).rejects.toThrow(
      new RegExp(`one of: ${mockInput.inputColumns.join(', ')}`),
    );
  });

  it('rejects more output columns than a run supports, saying how many there were', async () => {
    const fields = Array.from({ length: 26 }, (_, index) => ({
      ...sentiment,
      fieldName: `Column ${index}`,
      sortOrder: index,
    }));

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startPulseAnalysis({ ...mockInput, fields })).rejects.toThrow(
      /defines 26 output columns; PULSE supports up to 25/,
    );
  });

  it('accepts a free text column with no allowed values', async () => {
    const input = {
      ...mockInput,
      fields: [{
        ...sentiment,
        fieldName: 'Takeaway',
        fieldType: PulseFieldType.FREE_TEXT,
        allowedValues: [],
        defaultValue: null,
      }],
    };

    const caller = testRouter.createCaller(mockCtx);

    const result = await caller.startPulseAnalysis(input);

    expect(result).toMatchObject({ jobId: expect.any(String) });
  });

  it('reports when the queue is unavailable', async () => {
    mockGetPulseQueue.mockReturnValue(null);

    const caller = testRouter.createCaller(mockCtx);

    await expect(caller.startPulseAnalysis(mockInput)).rejects.toThrow(
      formatPulseError(queueUnavailableError()),
    );
  });
});
