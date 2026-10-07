import {
  PulseUserError,
  fallbackIsAllowedValueError,
  formatPulseError,
  headerRowEmptyError,
  matrixMissingHeaderError,
  matrixNoUsableRowsError,
  matrixTooManyColumnsError,
  modelAccessError,
  modelBusyError,
  modelFilteredError,
  modelInputTooLongError,
  modelUnknownError,
  noAnsweredRowsError,
  parsePulseErrorMessage,
  queueUnavailableError,
  sourceColumnUnresolvedError,
  stoppedUnexpectedlyError,
  storageUnavailableError,
  surveyUnreadableError,
  testInputInvalidError,
  testTimedOutError,
  uploadNetworkError,
  uploadTimedOutError,
  worksheetMissingError,
  type PulseError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import { MATRIX_FALLBACK_VALUE } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';

describe('formatPulseError', () => {
  it('joins the cause and the fix with a blank line and a Fix label', () => {
    expect(formatPulseError({ cause: 'The model timed out or was busy.', fix: 'Try again in a minute.' }))
      .toBe('The model timed out or was busy.\n\nFix: Try again in a minute.');
  });

  it('returns the cause alone when there is no fix', () => {
    expect(formatPulseError({ cause: 'Only a cause.', fix: null })).toBe('Only a cause.');
  });
});

describe('parsePulseErrorMessage', () => {
  it('reads back what formatPulseError wrote', () => {
    const error = modelAccessError('Claude Sonnet');

    expect(parsePulseErrorMessage(formatPulseError(error))).toEqual({ cause: error.cause, fix: error.fix });
  });

  it('treats a message with no Fix label as a cause with no fix', () => {
    expect(parsePulseErrorMessage('Something broke.')).toEqual({ cause: 'Something broke.', fix: null });
  });

  it('splits on the first Fix label only', () => {
    expect(parsePulseErrorMessage('Cause.\n\nFix: Step one.\n\nFix: Step two.'))
      .toEqual({ cause: 'Cause.', fix: 'Step one.\n\nFix: Step two.' });
  });
});

describe('PulseUserError', () => {
  it('carries the stored format as its message', () => {
    const error = new PulseUserError('The run stopped before it finished.', 'Run it again.');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PulseUserError);
    expect(error.name).toBe('PulseUserError');
    expect(error.message).toBe('The run stopped before it finished.\n\nFix: Run it again.');
    expect(error.pulseCause).toBe('The run stopped before it finished.');
    expect(error.fix).toBe('Run it again.');
  });

  it('builds from a PulseError', () => {
    const error = PulseUserError.from(queueUnavailableError());

    expect(error.message).toBe(formatPulseError(queueUnavailableError()));
  });
});

describe('builders', () => {
  it('names the missing matrix header and the headers that were found', () => {
    expect(matrixMissingHeaderError('Prompt', ['Column name', 'Source columns'])).toEqual({
      code: 'matrixMissingHeader',
      cause: 'The prompt matrix has no \'Prompt\' column. Found: \'Column name\', \'Source columns\'.',
      fix: 'Add a \'Prompt\' header, or start from the template.',
    });
  });

  it('says no headers were found when the scanned rows were empty', () => {
    expect(matrixMissingHeaderError('Column name', []).cause)
      .toBe('The prompt matrix has no \'Column name\' column. Found: no headers.');
  });

  it('lists the survey columns an unresolved source token could have been', () => {
    expect(sourceColumnUnresolvedError('Regoin', ['A – ID', 'B – Region'])).toEqual({
      code: 'sourceColumnUnresolved',
      cause: '\'Regoin\' doesn\'t match any survey column.',
      fix: 'Use a column letter or one of: A – ID, B – Region',
    });
  });

  it('lists the first eight survey columns, then how many more there are', () => {
    const labels = Array.from({ length: 11 }, (_, index) => `${String.fromCharCode(65 + index)} – Q${index + 1}`);

    expect(sourceColumnUnresolvedError('Z', labels).fix).toBe(
      'Use a column letter or one of: A – Q1, B – Q2, C – Q3, D – Q4, E – Q5, F – Q6, G – Q7, H – Q8, and 3 more',
    );
  });

  it('falls back to generic advice when the survey columns are unknown', () => {
    expect(sourceColumnUnresolvedError('Z', []).fix).toBe('Use a column letter or a header name from the survey.');
  });

  it('names the column and the fallback it repeats', () => {
    expect(fallbackIsAllowedValueError('Theme', MATRIX_FALLBACK_VALUE)).toEqual({
      code: 'fallbackIsAllowedValue',
      cause: `'Theme' lists "${MATRIX_FALLBACK_VALUE}" as an allowed value.`,
      fix: 'Remove it — PULSE uses it for answers it can\'t determine.',
    });
  });

  it('reports the output column count against the cap', () => {
    expect(matrixTooManyColumnsError(30, 25).cause)
      .toBe('The prompt matrix defines 30 output columns; PULSE supports up to 25.');
  });

  it('names every column a too-long response was sent for', () => {
    expect(modelInputTooLongError('Claude Sonnet', ['Sentiment']).fix)
      .toBe('Point \'Sentiment\' at fewer source columns, or pick a model with a larger context.');
    expect(modelInputTooLongError('Claude Sonnet', ['Sentiment', 'Theme']).fix)
      .toBe('Point \'Sentiment\' and \'Theme\' at fewer source columns, or pick a model with a larger context.');
    expect(modelInputTooLongError('Claude Sonnet', ['Sentiment', 'Theme', 'Gap']).fix)
      .toBe('Point \'Sentiment\', \'Theme\', and \'Gap\' at fewer source columns, or pick a model with a larger context.');
    expect(modelInputTooLongError('Claude Sonnet', []).fix)
      .toBe('Point the output columns at fewer source columns, or pick a model with a larger context.');
    expect(modelInputTooLongError('Claude Sonnet', ['Sentiment']).cause)
      .toBe('The response was too long for Claude Sonnet.');
  });

  it('keeps a long provider message to 300 characters', () => {
    const error = modelUnknownError('Claude Sonnet', 'x'.repeat(400));

    expect(error.cause).toBe(`Claude Sonnet returned an error: ${'x'.repeat(299)}…`);
  });

  it('says there were no details when the provider message is blank', () => {
    expect(modelUnknownError('Claude Sonnet', '  ').cause).toBe('Claude Sonnet returned an error: no details');
  });

  it('puts one zod issue per line and offers no fix', () => {
    const error = testInputInvalidError(['Persona is required.', 'Add at least one output column.']);

    expect(error.fix).toBeNull();
    expect(formatPulseError(error)).toBe('Persona is required.\nAdd at least one output column.');
  });

  it('gives every situation a cause and a code', () => {
    const errors: PulseError[] = [
      matrixMissingHeaderError('Prompt', []),
      sourceColumnUnresolvedError('Q', []),
      fallbackIsAllowedValueError('Theme', MATRIX_FALLBACK_VALUE),
      matrixNoUsableRowsError(),
      matrixTooManyColumnsError(26, 25),
      surveyUnreadableError(),
      worksheetMissingError('Round two'),
      headerRowEmptyError(3, 'Feedback'),
      noAnsweredRowsError(['B', 'C']),
      modelBusyError(),
      modelAccessError('Claude Sonnet'),
      modelInputTooLongError('Claude Sonnet', ['Sentiment']),
      modelFilteredError('Claude Sonnet'),
      modelUnknownError('Claude Sonnet', 'boom'),
      testInputInvalidError(['Persona is required.']),
      testTimedOutError(),
      storageUnavailableError(),
      queueUnavailableError(),
      stoppedUnexpectedlyError(),
      uploadNetworkError(),
      uploadTimedOutError(),
    ];

    expect(new Set(errors.map((error) => error.code)).size).toBe(errors.length);
    errors.forEach((error) => {
      expect(error.cause.length).toBeGreaterThan(0);
    });
  });

  it('writes the survey, run, and upload situations as the spec words them', () => {
    expect(worksheetMissingError('Round two').cause).toBe('The worksheet \'Round two\' isn\'t in the uploaded survey.');
    expect(headerRowEmptyError(3, 'Feedback').cause).toBe('Row 3 of \'Feedback\' has no column headers.');
    expect(noAnsweredRowsError(['B', 'C']).cause)
      .toBe('No rows have answers in the columns the matrix reads (B, C).');
    expect(modelAccessError('Claude Sonnet').cause).toBe('You don\'t have access to Claude Sonnet.');
    expect(modelFilteredError('Claude Sonnet').cause).toBe('Claude Sonnet declined to answer this response.');
    expect(uploadTimedOutError().cause).toBe('The survey upload took longer than 5 minutes.');
  });
});
