import extractRowValues from '@/features/ai-agents/utils/pulse/worker/extractRow';
import {
  AuthorizationError,
  RateLimitExceededError,
  TransientConnectionError,
} from '@/features/ai-provider/sources/errors';
import { PULSE_DEFAULT_PERSONA, PULSE_ANALYSIS_RULES } from '@/features/ai-agents/data/pulse/prompts';
import {
  formatPulseError,
  modelAccessError,
  modelBusyError,
  modelInputTooLongError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import {
  PulseFieldType,
  type ParsedSurveyRow,
  type PulseFieldConfig,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const row: ParsedSurveyRow = {
  rowNumber: 2,
  cells: {
    B: { column: 'B', header: 'What did you like?', value: 'The advice column' },
    C: { column: 'C', header: 'How often do you read it?', value: 'Every month' },
  },
  responseText: 'What did you like?:\nThe advice column',
};

const sentiment: PulseFieldConfig = {
  fieldName: 'Sentiment',
  prompt: 'Judge the overall sentiment.',
  fieldType: PulseFieldType.CATEGORY,
  allowedValues: ['Positive', 'Neutral', 'Negative'],
  defaultValue: 'Neutral',
  inputColumnRefs: [],
  sortOrder: 0,
};

const frequency: PulseFieldConfig = {
  fieldName: 'Reading Frequency',
  prompt: 'How often do they read it?',
  fieldType: PulseFieldType.SCALE,
  allowedValues: ['Every Month', 'Sometimes', 'Never'],
  defaultValue: 'Sometimes',
  inputColumnRefs: ['C'],
  sortOrder: 1,
};

const takeaway: PulseFieldConfig = {
  fieldName: 'Takeaway',
  prompt: 'Summarize their main point.',
  fieldType: PulseFieldType.FREE_TEXT,
  allowedValues: [],
  defaultValue: null,
  inputColumnRefs: [],
  sortOrder: 2,
};

function adapterReturning(...responses: string[]) {
  const chat = jest.fn();
  responses.forEach((content) => {
    chat.mockResolvedValueOnce({ message: { content, role: 'assistant' } });
  });
  // Any call past the scripted responses returns unusable output rather than undefined.
  chat.mockResolvedValue({ message: { content: 'no', role: 'assistant' } });
  return { chat };
}

// Answers whichever fields a call actually asks for, so a test never depends on the order
// fields get split into calls.
function adapterAnswering(answers: Record<string, string>) {
  const chat = jest.fn().mockImplementation((request: { messages: { content: string }[] }) => {
    const prompt = request.messages[request.messages.length - 1].content;
    const asked = Object.keys(answers).filter((name) => prompt.includes(`Field "${name}"`));

    return Promise.resolve({
      message: {
        content: JSON.stringify(Object.fromEntries(asked.map((name) => [name, answers[name]]))),
        role: 'assistant',
      },
    });
  });

  return { chat };
}

function lastPromptOf(chat: jest.Mock): string {
  const request = chat.mock.calls[chat.mock.calls.length - 1][0] as { messages: { content: string }[] };

  return request.messages[request.messages.length - 1].content;
}

const base = {
  row,
  persona: 'You are a survey analyst.',
  modelName: 'Claude Sonnet',
};

describe('extractRowValues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a validated value for every field', async () => {
    const completionAdapter = adapterAnswering({
      Sentiment: 'Positive',
      'Reading Frequency': 'Every Month',
      Takeaway: 'Likes the advice column.',
    });

    const values = await extractRowValues({
      ...base,
      fields: [sentiment, frequency, takeaway],
      completionAdapter,
    });

    expect(values).toEqual([
      { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false, failureReason: null },
      { fieldName: 'Reading Frequency', value: 'Every Month', wasDefaulted: false, failureReason: null },
      { fieldName: 'Takeaway', value: 'Likes the advice column.', wasDefaulted: false, failureReason: null },
    ]);
  });

  it('derives the fields that read the same columns together, and the rest separately', async () => {
    const completionAdapter = adapterAnswering({
      Sentiment: 'Positive',
      'Reading Frequency': 'Every Month',
      Takeaway: 'Likes the advice column.',
    });

    await extractRowValues({
      ...base,
      fields: [sentiment, frequency, takeaway],
      completionAdapter,
    });

    // Sentiment and Takeaway read the whole response; Reading Frequency reads only column C.
    expect(completionAdapter.chat).toHaveBeenCalledTimes(2);
  });

  it('shows a field only the columns it was pointed at', async () => {
    const completionAdapter = adapterAnswering({ 'Reading Frequency': 'Every Month' });

    const values = await extractRowValues({ ...base, fields: [frequency], completionAdapter });

    const prompt = lastPromptOf(completionAdapter.chat);

    expect(prompt).toContain('How often do you read it?');
    expect(prompt).not.toContain('What did you like?');
    expect(values[0]).toMatchObject({ value: 'Every Month', wasDefaulted: false });
  });

  it('leaves a field empty without asking the model when the columns it reads are blank', async () => {
    const completionAdapter = adapterAnswering({ 'Reading Frequency': 'Every Month' });

    const values = await extractRowValues({
      ...base,
      row: {
        rowNumber: 3,
        cells: {
          B: { column: 'B', header: 'What did you like?', value: 'The advice column' },
          C: { column: 'C', header: 'How often do you read it?', value: '' },
        },
        responseText: 'What did you like?:\nThe advice column',
      },
      fields: [frequency],
      completionAdapter,
    });

    expect(completionAdapter.chat).not.toHaveBeenCalled();
    expect(values).toEqual([
      { fieldName: 'Reading Frequency', value: '', wasDefaulted: false, failureReason: null },
    ]);
  });

  it('returns values in field order regardless of the order the model returned them', async () => {
    const completionAdapter = adapterReturning(
      JSON.stringify({ Takeaway: 'Likes it.', Sentiment: 'Positive' }),
    );

    const values = await extractRowValues({
      ...base,
      fields: [sentiment, takeaway],
      completionAdapter,
    });

    expect(values.map((v) => v.fieldName)).toEqual(['Sentiment', 'Takeaway']);
  });

  it('sends the persona as the system message', async () => {
    const completionAdapter = adapterReturning(JSON.stringify({ Sentiment: 'Positive' }));

    await extractRowValues({ ...base, fields: [sentiment], completionAdapter });

    expect(completionAdapter.chat).toHaveBeenCalledWith({
      messages: [
        { role: 'system', content: `You are a survey analyst.\n\n${PULSE_ANALYSIS_RULES}` },
        { role: 'user', content: expect.stringContaining('The advice column') },
      ],
    });
  });

  it('falls back to the default persona when the persona is blank', async () => {
    const completionAdapter = adapterReturning(JSON.stringify({ Sentiment: 'Positive' }));

    await extractRowValues({ ...base, persona: '  ', fields: [sentiment], completionAdapter });

    expect(completionAdapter.chat).toHaveBeenCalledWith({
      messages: [
        { role: 'system', content: `${PULSE_DEFAULT_PERSONA}\n\n${PULSE_ANALYSIS_RULES}` },
        { role: 'user', content: expect.stringContaining('The advice column') },
      ],
    });
  });

  it('tolerates a fenced JSON response', async () => {
    const completionAdapter = adapterReturning('```json\n{"Sentiment": "Negative"}\n```');

    const values = await extractRowValues({ ...base, fields: [sentiment], completionAdapter });

    expect(values[0]).toMatchObject({ value: 'Negative', wasDefaulted: false });
  });

  it('tolerates prose surrounding the JSON object', async () => {
    const completionAdapter = adapterReturning('Here you go: {"Sentiment": "Neutral"} Hope that helps.');

    const values = await extractRowValues({ ...base, fields: [sentiment], completionAdapter });

    expect(values[0]).toMatchObject({ value: 'Neutral', wasDefaulted: false });
  });

  it('retries only the failing cell', async () => {
    const completionAdapter = adapterReturning(
      JSON.stringify({ Sentiment: 'Mostly positive', 'Reading Frequency': 'Every Month' }),
      JSON.stringify({ Sentiment: 'Positive' }),
    );

    const values = await extractRowValues({
      ...base,
      fields: [sentiment, frequency],
      completionAdapter,
    });

    expect(completionAdapter.chat).toHaveBeenCalledTimes(2);
    expect(values[0]).toEqual({
      fieldName: 'Sentiment',
      value: 'Positive',
      wasDefaulted: false,
      failureReason: null,
    });
    expect(values[1]).toMatchObject({ value: 'Every Month', wasDefaulted: false });
  });

  it('scopes the retry call to the field referenced columns', async () => {
    const completionAdapter = adapterReturning(
      JSON.stringify({ 'Reading Frequency': 'Once in a while' }),
      JSON.stringify({ 'Reading Frequency': 'Sometimes' }),
    );

    await extractRowValues({ ...base, fields: [frequency], completionAdapter });

    const retryPrompt = completionAdapter.chat.mock.calls[1][0].messages[1].content;

    expect(retryPrompt).toContain('Every month');
    expect(retryPrompt).not.toContain('The advice column');
  });

  it('accepts a bare value from the retry when the model does not return JSON', async () => {
    const completionAdapter = adapterReturning(
      JSON.stringify({ Sentiment: 'Mostly positive' }),
      'Positive',
    );

    const values = await extractRowValues({ ...base, fields: [sentiment], completionAdapter });

    expect(values[0]).toMatchObject({ value: 'Positive', wasDefaulted: false });
  });

  it('falls back to the default value and marks it when the retry also fails', async () => {
    const completionAdapter = adapterReturning(
      JSON.stringify({ Sentiment: 'Mostly positive' }),
      JSON.stringify({ Sentiment: 'Still mostly positive' }),
    );

    const values = await extractRowValues({ ...base, fields: [sentiment], completionAdapter });

    expect(values[0]).toEqual({
      fieldName: 'Sentiment',
      value: 'Neutral',
      wasDefaulted: true,
      failureReason: expect.stringContaining('Positive, Neutral, Negative'),
    });
  });

  it('stores an empty marked value for a free text field with no default', async () => {
    const completionAdapter = adapterReturning(
      JSON.stringify({ Takeaway: '' }),
      JSON.stringify({ Takeaway: '' }),
    );

    const values = await extractRowValues({ ...base, fields: [takeaway], completionAdapter });

    expect(values[0]).toEqual({
      fieldName: 'Takeaway',
      value: '',
      wasDefaulted: true,
      failureReason: 'Value was empty',
    });
  });

  it('defaults every field when the row call returns unparseable output', async () => {
    const completionAdapter = adapterReturning('I could not process this response.', 'still no', 'still no');

    const values = await extractRowValues({
      ...base,
      fields: [sentiment, frequency],
      completionAdapter,
    });

    expect(values).toEqual([
      { fieldName: 'Sentiment', value: 'Neutral', wasDefaulted: true, failureReason: expect.any(String) },
      { fieldName: 'Reading Frequency', value: 'Sometimes', wasDefaulted: true, failureReason: expect.any(String) },
    ]);
  });

  it('defaults a field when the row call throws', async () => {
    const chat = jest.fn().mockRejectedValue(new Error('Bedrock timeout'));

    const values = await extractRowValues({
      ...base,
      fields: [sentiment],
      completionAdapter: { chat },
    });

    expect(values[0]).toMatchObject({ value: 'Neutral', wasDefaulted: true });
  });

  it('skips per-field retries and defaults every cell with the timeout reason when the row times out', async () => {
    const chat = jest.fn().mockRejectedValue(new TransientConnectionError('socket hang up', 'ETIMEDOUT'));

    const values = await extractRowValues({
      ...base,
      fields: [sentiment, frequency],
      completionAdapter: { chat },
    });

    // Two calls are the row's two sets of source columns; a per-field retry would add more.
    expect(chat).toHaveBeenCalledTimes(2);
    expect(values).toEqual([
      { fieldName: 'Sentiment', value: 'Neutral', wasDefaulted: true, failureReason: expect.stringMatching(/try again/i) },
      { fieldName: 'Reading Frequency', value: 'Sometimes', wasDefaulted: true, failureReason: expect.stringMatching(/try again/i) },
    ]);
  });

  it('still retries a field whose own call succeeded when a different set of columns timed out', async () => {
    let sentimentCalls = 0;
    const chat = jest.fn().mockImplementation((request: { messages: { content: string }[] }) => {
      const prompt = request.messages[request.messages.length - 1].content;

      if (prompt.includes('Field "Reading Frequency"')) {
        return Promise.reject(new TransientConnectionError('socket hang up', 'ETIMEDOUT'));
      }

      sentimentCalls += 1;
      const content = JSON.stringify({ Sentiment: sentimentCalls === 1 ? 'Mostly positive' : 'Positive' });

      return Promise.resolve({ message: { content, role: 'assistant' } });
    });

    const values = await extractRowValues({
      ...base,
      fields: [sentiment, frequency],
      completionAdapter: { chat },
    });

    expect(values[0]).toEqual({
      fieldName: 'Sentiment',
      value: 'Positive',
      wasDefaulted: false,
      failureReason: null,
    });
    expect(values[1]).toMatchObject({
      value: 'Sometimes',
      wasDefaulted: true,
      failureReason: expect.stringMatching(/try again/i),
    });
  });

  it('defaults a field when its retry call throws', async () => {
    const chat = jest.fn()
      .mockResolvedValueOnce({ message: { content: JSON.stringify({ Sentiment: 'Mostly positive' }), role: 'assistant' } })
      .mockRejectedValueOnce(new Error('Bedrock timeout'));

    const values = await extractRowValues({
      ...base,
      fields: [sentiment],
      completionAdapter: { chat },
    });

    expect(values[0]).toMatchObject({ value: 'Neutral', wasDefaulted: true });
  });

  it('keeps the access error as the reason when the row call and its retry are both refused', async () => {
    const chat = jest.fn().mockRejectedValue(new AuthorizationError('Access denied'));

    const values = await extractRowValues({
      ...base,
      fields: [sentiment],
      completionAdapter: { chat },
    });

    expect(values[0]).toEqual({
      fieldName: 'Sentiment',
      value: 'Neutral',
      wasDefaulted: true,
      failureReason: formatPulseError(modelAccessError('Claude Sonnet')),
    });
  });

  it('keeps the row call\'s error as the reason when the retry answers with something unusable', async () => {
    const chat = jest.fn()
      .mockRejectedValueOnce(new AuthorizationError('Access denied'))
      .mockResolvedValue({ message: { content: 'no', role: 'assistant' } });

    const values = await extractRowValues({
      ...base,
      fields: [sentiment],
      completionAdapter: { chat },
    });

    expect(values[0].failureReason).toBe(formatPulseError(modelAccessError('Claude Sonnet')));
  });

  it('still retries a field after a row call error that is not worth waiting out', async () => {
    const chat = jest.fn()
      .mockRejectedValueOnce(new Error('malformed request'))
      .mockResolvedValueOnce({ message: { content: JSON.stringify({ Sentiment: 'Positive' }), role: 'assistant' } });

    const values = await extractRowValues({
      ...base,
      fields: [sentiment],
      completionAdapter: { chat },
    });

    expect(chat).toHaveBeenCalledTimes(2);
    expect(values[0]).toEqual({
      fieldName: 'Sentiment',
      value: 'Positive',
      wasDefaulted: false,
      failureReason: null,
    });
  });

  it('names the output column when a response is too long for the model', async () => {
    const chat = jest.fn().mockRejectedValue(new Error('Input is too long for requested model.'));

    const values = await extractRowValues({
      ...base,
      fields: [sentiment],
      completionAdapter: { chat },
    });

    expect(values[0].failureReason).toBe(formatPulseError(modelInputTooLongError('Claude Sonnet', ['Sentiment'])));
  });

  it('gives the retry call\'s own error when only the retry fails', async () => {
    const chat = jest.fn()
      .mockResolvedValueOnce({ message: { content: JSON.stringify({ Sentiment: 'Mostly positive' }), role: 'assistant' } })
      .mockRejectedValueOnce(new RateLimitExceededError('throttled'));

    const values = await extractRowValues({
      ...base,
      fields: [sentiment],
      completionAdapter: { chat },
    });

    expect(values[0]).toMatchObject({
      value: 'Neutral',
      wasDefaulted: true,
      failureReason: formatPulseError(modelBusyError()),
    });
  });
});
