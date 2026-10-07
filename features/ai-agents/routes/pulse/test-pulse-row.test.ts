import { ContextType } from '@/server/trpc-context';
import { router } from '@/server/trpc';
import testPulseRow, { TEST_ROW_TIME_BUDGET_MS } from '@/features/ai-agents/routes/pulse/test-pulse-row';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import extractRowValues from '@/features/ai-agents/utils/pulse/worker/extractRow';
import { AiAgentType } from '@/features/shared/types';
import { PulseFieldType } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import {
  formatPulseError,
  testTimedOutError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';

const mockChatCompletion = jest.fn();

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/utils/pulse/worker/extractRow');
jest.mock('@/features/shared/services/resolveUserGroupId', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue('group-1'),
}));
jest.mock('@/features/ai-provider/factory', () => ({
  AIFactory: jest.fn().mockImplementation(() => ({
    buildUserSource: jest.fn().mockResolvedValue({
      source: { chatCompletion: mockChatCompletion },
      model: { externalId: 'ext-model-1', name: 'Claude Sonnet' },
    }),
  })),
}));
jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockGetAvailableAgents = getAvailableAgents as jest.Mock;
const mockExtract = extractRowValues as jest.Mock;

const testRouter = router({
  testPulseRow,
});

const agentId = '11111111-1111-1111-1111-111111111111';

const input = {
  agentId,
  modelId: 'claude-opus-5',
  persona: 'You are a survey analyst.',
  rowNumber: 2,
  cells: [
    { column: 'B', header: 'What did you like?', value: 'The advice column' },
    { column: 'C', header: 'How often?', value: 'Every month' },
  ],
  fields: [{
    fieldName: 'Sentiment',
    prompt: 'Judge sentiment.',
    fieldType: PulseFieldType.CATEGORY,
    allowedValues: ['Positive', 'Negative'],
    defaultValue: 'Positive',
    inputColumnRefs: [],
    sortOrder: 0,
  }],
  userGroupId: null,
};

type TestInput = typeof input;

// Sends a deliberately malformed payload, as a stale or tampered client would.
function malformed(value: Record<string, unknown>): TestInput {
  return value as unknown as TestInput;
}

describe('testPulseRow', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'user-1',
      logger: console,
      errorAuditor: { createErrorRecord: jest.fn() },
    } as unknown as ContextType;
    mockGetAvailableAgents.mockResolvedValue([{ id: agentId, type: AiAgentType.PULSE }]);
    mockExtract.mockResolvedValue([
      { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false, failureReason: null },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the derived values for the single row', async () => {
    const result = await testRouter.createCaller(mockCtx).testPulseRow(input);

    expect(result).toEqual({
      values: [{ fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false, failureReason: null }],
    });
  });

  it('surfaces why a value fell back to its default', async () => {
    mockExtract.mockResolvedValue([
      { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: true, failureReason: 'Value was empty' },
    ]);

    const result = await testRouter.createCaller(mockCtx).testPulseRow(input);

    expect(result.values[0]).toMatchObject({ wasDefaulted: true, failureReason: 'Value was empty' });
  });

  it('runs the matrix the user is currently editing', async () => {
    await testRouter.createCaller(mockCtx).testPulseRow(input);

    expect(mockExtract).toHaveBeenCalledWith(expect.objectContaining({
      fields: input.fields,
      persona: 'You are a survey analyst.',
      modelName: 'Claude Sonnet',
    }));
    expect(mockExtract.mock.calls[0][0]).not.toHaveProperty('responseGuidelines');
  });

  it('passes the row cells keyed by column letter', async () => {
    await testRouter.createCaller(mockCtx).testPulseRow(input);

    expect(mockExtract.mock.calls[0][0].row.cells).toEqual({
      B: { column: 'B', header: 'What did you like?', value: 'The advice column' },
      C: { column: 'C', header: 'How often?', value: 'Every month' },
    });
  });

  it('trims a column name so it still matches what the model returns', async () => {
    const padded = {
      ...input,
      fields: [{ ...input.fields[0], fieldName: '  Sentiment  ' }],
    };

    await testRouter.createCaller(mockCtx).testPulseRow(padded);

    expect(mockExtract.mock.calls[0][0].fields[0].fieldName).toBe('Sentiment');
  });

  it('rejects two output columns under one name, as a real run does', async () => {
    const duplicated = {
      ...input,
      fields: [input.fields[0], { ...input.fields[0], fieldName: 'sentiment', sortOrder: 1 }],
    };

    await expect(testRouter.createCaller(mockCtx).testPulseRow(duplicated)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Output columns: Each output column needs a distinct name.',
    });
  });

  it('explains invalid input in one plain line per problem', async () => {
    const invalid = {
      ...input,
      cells: [{ ...input.cells[0], column: 'b1' }],
      fields: [{ ...input.fields[0], prompt: '' }],
    };

    await expect(testRouter.createCaller(mockCtx).testPulseRow(invalid)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: [
        'Response cell 1 column: not a column letter (like B or AA)',
        'Output column 1 prompt: empty',
      ].join('\n'),
    });
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('names a missing setting rather than showing a schema dump', async () => {
    const { modelId: _modelId, ...withoutModel } = input;

    await expect(testRouter.createCaller(mockCtx).testPulseRow(malformed(withoutModel)))
      .rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'Model: missing' });
  });

  it('says how far over the limit a matrix with too many columns is', async () => {
    const tooMany = {
      ...input,
      fields: Array.from({ length: 26 }, (_, index) => ({
        ...input.fields[0],
        fieldName: `Column ${index + 1}`,
        sortOrder: index,
      })),
    };

    await expect(testRouter.createCaller(mockCtx).testPulseRow(tooMany)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Output columns: over the limit of 25',
    });
  });

  it('lists the allowed choices when a column type is not one of them', async () => {
    const badType = malformed({
      ...input,
      fields: [{ ...input.fields[0], fieldType: 'yesNo' }],
    });

    await expect(testRouter.createCaller(mockCtx).testPulseRow(badType)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: `Output column 1 type: must be one of ${Object.values(PulseFieldType).join(', ')}`,
    });
  });

  it('describes a wrong kind of value by what was expected', async () => {
    await expect(testRouter.createCaller(mockCtx).testPulseRow(malformed({ ...input, rowNumber: 'two' })))
      .rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'Row number: expected number, got string' });
  });

  it('stops a test that runs past the time budget with a cause and fix', async () => {
    jest.useFakeTimers();

    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mockExtract.mockImplementation(() => {
      markStarted();
      return new Promise(() => undefined);
    });

    const settled = expect(testRouter.createCaller(mockCtx).testPulseRow(input)).rejects.toMatchObject({
      code: 'TIMEOUT',
      message: formatPulseError(testTimedOutError()),
    });

    await started;
    jest.advanceTimersByTime(TEST_ROW_TIME_BUDGET_MS);

    await settled;
  });

  it('allows a test to take up to ninety seconds', () => {
    expect(TEST_ROW_TIME_BUDGET_MS).toBe(90_000);
  });

  it('leaves no timer running once a test finishes in time', async () => {
    jest.useFakeTimers();

    await testRouter.createCaller(mockCtx).testPulseRow(input);

    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects an agent the user cannot access', async () => {
    mockGetAvailableAgents.mockResolvedValue([]);

    await expect(testRouter.createCaller(mockCtx).testPulseRow(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'PULSE agent not found or access denied',
    });
  });
});
