import {
  isTrackableUserId,
  parseUsageAttribution,
  parseUsageAttributionHeaders,
} from '@/features/ai-provider/utils/usageAttribution';

const CHAT_MESSAGE_ID = '11111111-1111-4111-8111-111111111111';
const WORKFLOW_EXECUTION_ID = '22222222-2222-4222-8222-222222222222';
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';

describe('parseUsageAttribution', () => {
  it('should return every field when all are valid', () => {
    const result = parseUsageAttribution({
      chatMessageId: CHAT_MESSAGE_ID,
      workflowExecutionId: WORKFLOW_EXECUTION_ID,
      documentId: DOCUMENT_ID,
      primitiveId: 'step-llm',
      stepLabel: 'query embedding',
    });

    expect(result).toEqual({
      chatMessageId: CHAT_MESSAGE_ID,
      workflowExecutionId: WORKFLOW_EXECUTION_ID,
      documentId: DOCUMENT_ID,
      primitiveId: 'step-llm',
      stepLabel: 'query embedding',
    });
  });

  // An empty object means 'no attribution', which is what the tracker already
  // receives today from callers that pass nothing.
  it('should return an empty object when no attribution fields are present', () => {
    expect(parseUsageAttribution({ userId: USER_ID, modelId: 'model-1' })).toEqual({});
  });

  // A bad uuid would fail the usage insert, and AiProviderUsageTracker rethrows
  // on a failed insert, so the field is dropped rather than the request failing.
  it('should drop uuid fields that are not uuids and keep the rest', () => {
    const result = parseUsageAttribution({
      chatMessageId: 'not-a-uuid',
      workflowExecutionId: WORKFLOW_EXECUTION_ID,
      documentId: '12345',
      stepLabel: 'response',
    });

    expect(result).toEqual({
      workflowExecutionId: WORKFLOW_EXECUTION_ID,
      stepLabel: 'response',
    });
  });

  // primitiveId is a plain string column: workflow node ids are not uuids.
  it('should keep a primitiveId that is not a uuid', () => {
    expect(parseUsageAttribution({ primitiveId: 'step-llm' })).toEqual({ primitiveId: 'step-llm' });
  });

  it('should trim surrounding whitespace', () => {
    expect(parseUsageAttribution({ stepLabel: '  output citations  ' })).toEqual({
      stepLabel: 'output citations',
    });
  });

  it('should ignore blank and whitespace-only values', () => {
    expect(parseUsageAttribution({ primitiveId: '', stepLabel: '   ' })).toEqual({});
  });

  it('should ignore values that are not strings', () => {
    expect(parseUsageAttribution({ primitiveId: 42, stepLabel: { text: 'nope' } })).toEqual({});
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'chatMessageId=1'],
    ['a number', 7],
  ])('should return an empty object when the input is %s', (_label, input) => {
    expect(parseUsageAttribution(input)).toEqual({});
  });
});

describe('parseUsageAttributionHeaders', () => {
  it('should read every attribution header', () => {
    const result = parseUsageAttributionHeaders({
      'x-user-id': USER_ID,
      'x-chat-message-id': CHAT_MESSAGE_ID,
      'x-workflow-execution-id': WORKFLOW_EXECUTION_ID,
      'x-document-id': DOCUMENT_ID,
      'x-primitive-id': 'step-llm',
      'x-step-label': 'skill run',
    });

    expect(result).toEqual({
      chatMessageId: CHAT_MESSAGE_ID,
      workflowExecutionId: WORKFLOW_EXECUTION_ID,
      documentId: DOCUMENT_ID,
      primitiveId: 'step-llm',
      stepLabel: 'skill run',
    });
  });

  it('should return an empty object when no attribution headers are present', () => {
    expect(parseUsageAttributionHeaders({ 'x-user-id': USER_ID })).toEqual({});
  });

  // Node represents a repeated header as an array.
  it('should use the first value of a repeated header', () => {
    expect(parseUsageAttributionHeaders({ 'x-chat-message-id': [CHAT_MESSAGE_ID, 'second'] })).toEqual({
      chatMessageId: CHAT_MESSAGE_ID,
    });
  });

  it('should drop a header whose uuid is malformed', () => {
    expect(parseUsageAttributionHeaders({ 'x-chat-message-id': 'abc' })).toEqual({});
  });
});

describe('isTrackableUserId', () => {
  it('should accept a uuid', () => {
    expect(isTrackableUserId(USER_ID)).toBe(true);
  });

  // The proxy defaults an absent x-user-id to the literal 'system', but
  // AiProviderUsage.userId is a uuid with a foreign key to User and no 'system'
  // row exists, so tracking that call would make every request fail.
  it.each([
    ['the literal system placeholder', 'system'],
    ['undefined', undefined],
    ['an empty string', ''],
    ['a non-uuid string', 'user-1'],
  ])('should reject %s', (_label, value) => {
    expect(isTrackableUserId(value)).toBe(false);
  });
});
