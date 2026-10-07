export type PulseErrorCode =
  | 'matrixMissingHeader'
  | 'sourceColumnUnresolved'
  | 'fallbackIsAllowedValue'
  | 'matrixNoUsableRows'
  | 'matrixTooManyColumns'
  | 'surveyUnreadable'
  | 'worksheetMissing'
  | 'headerRowEmpty'
  | 'noAnsweredRows'
  | 'modelBusy'
  | 'modelAccess'
  | 'modelInputTooLong'
  | 'modelFiltered'
  | 'modelUnknown'
  | 'testInputInvalid'
  | 'testTimedOut'
  | 'storageUnavailable'
  | 'queueUnavailable'
  | 'stoppedUnexpectedly'
  | 'uploadNetworkError'
  | 'uploadTimedOut';

export type PulseError = {
  code: PulseErrorCode;
  cause: string;
  // null when the cause alone tells the user what to change.
  fix: string | null;
};

const FIX_SEPARATOR = '\n\nFix: ';
const MAX_LISTED_ITEMS = 8;
const MAX_MODEL_MESSAGE_LENGTH = 300;

export function formatPulseError(error: Pick<PulseError, 'cause' | 'fix'>): string {
  if (error.fix === null || error.fix.length === 0) {
    return error.cause;
  }

  return `${error.cause}${FIX_SEPARATOR}${error.fix}`;
}

export function parsePulseErrorMessage(message: string): { cause: string; fix: string | null } {
  const index = message.indexOf(FIX_SEPARATOR);

  if (index === -1) {
    return { cause: message, fix: null };
  }

  return { cause: message.slice(0, index), fix: message.slice(index + FIX_SEPARATOR.length) };
}

// Thrown where the text must reach the user intact; `message` is already the stored format.
export class PulseUserError extends Error {
  readonly pulseCause: string;
  readonly fix: string | null;

  constructor(cause: string, fix: string | null) {
    super(formatPulseError({ cause, fix }));
    this.name = 'PulseUserError';
    this.pulseCause = cause;
    this.fix = fix;
    Object.setPrototypeOf(this, PulseUserError.prototype);
  }

  static from(error: PulseError): PulseUserError {
    return new PulseUserError(error.cause, error.fix);
  }
}

function quoted(value: string): string {
  return `'${value}'`;
}

// 'A', 'A' and 'B', or 'A', 'B', and 'C'.
function quotedList(values: string[]): string {
  const items = values.map(quoted);

  if (items.length <= 2) {
    return items.join(' and ');
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// The first eight items, then a count of the rest, so a wide survey stays one readable line.
function listWithRemainder(items: string[]): string {
  const shown = items.slice(0, MAX_LISTED_ITEMS).join(', ');
  const remaining = items.length - MAX_LISTED_ITEMS;

  return remaining > 0 ? `${shown}, and ${remaining} more` : shown;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function matrixMissingHeaderError(missingHeader: string, foundHeaders: string[]): PulseError {
  const found = foundHeaders.length > 0 ? listWithRemainder(foundHeaders.map(quoted)) : 'no headers';

  return {
    code: 'matrixMissingHeader',
    cause: `The prompt matrix has no ${quoted(missingHeader)} column. Found: ${found}.`,
    fix: `Add a ${quoted(missingHeader)} header, or start from the template.`,
  };
}

export function sourceColumnUnresolvedError(token: string, columnLabels: string[]): PulseError {
  // A comma inside a header makes the comma-joined list hard to read, so the letter leads there.
  const offered = columnLabels.some((label) => label.includes(','))
    ? `Use the column letter, or a whole header from: ${listWithRemainder(columnLabels)}`
    : `Use a column letter or one of: ${listWithRemainder(columnLabels)}`;

  return {
    code: 'sourceColumnUnresolved',
    cause: `${quoted(token)} doesn't match any survey column.`,
    fix: columnLabels.length > 0 ? offered : 'Use a column letter or a header name from the survey.',
  };
}

export function fallbackIsAllowedValueError(fieldName: string, fallback: string): PulseError {
  return {
    code: 'fallbackIsAllowedValue',
    cause: `${quoted(fieldName)} lists "${fallback}" as an allowed value.`,
    fix: 'Remove it — PULSE uses it for answers it can\'t determine.',
  };
}

export function matrixNoUsableRowsError(): PulseError {
  return {
    code: 'matrixNoUsableRows',
    cause: 'The prompt matrix has no rows with both a column name and a prompt.',
    fix: 'Fill in at least one row below the header, or start from the template.',
  };
}

export function matrixTooManyColumnsError(count: number, max: number): PulseError {
  return {
    code: 'matrixTooManyColumns',
    cause: `The prompt matrix defines ${count} output columns; PULSE supports up to ${max}.`,
    fix: 'Split it into two matrices and run them separately.',
  };
}

export function surveyUnreadableError(): PulseError {
  return {
    code: 'surveyUnreadable',
    cause: 'The survey couldn\'t be read as an Excel workbook.',
    fix: 'Save it as .xlsx and upload again.',
  };
}

export function worksheetMissingError(sheetName: string): PulseError {
  return {
    code: 'worksheetMissing',
    cause: `The worksheet ${quoted(sheetName)} isn't in the uploaded survey.`,
    fix: 'Pick a worksheet from the list, or re-upload the file it came from.',
  };
}

export function headerRowEmptyError(rowNumber: number, sheetName: string): PulseError {
  return {
    code: 'headerRowEmpty',
    cause: `Row ${rowNumber} of ${quoted(sheetName)} has no column headers.`,
    fix: 'Put the question headers in one row above the answers.',
  };
}

export function noAnsweredRowsError(letters: string[]): PulseError {
  return {
    code: 'noAnsweredRows',
    cause: `No rows have answers in the columns the matrix reads (${letters.join(', ')}).`,
    fix: 'Check the Source columns in the matrix point at the survey\'s answer columns.',
  };
}

export function modelBusyError(): PulseError {
  return {
    code: 'modelBusy',
    cause: 'The model timed out or was busy.',
    fix: 'Try again in a minute.',
  };
}

export function modelAccessError(modelName: string): PulseError {
  return {
    code: 'modelAccess',
    cause: `You don't have access to ${modelName}.`,
    fix: 'Pick another model, or ask an admin to enable it.',
  };
}

export function modelInputTooLongError(modelName: string, fieldNames: string[]): PulseError {
  const target = fieldNames.length > 0 ? quotedList(fieldNames) : 'the output columns';

  return {
    code: 'modelInputTooLong',
    cause: `The response was too long for ${modelName}.`,
    fix: `Point ${target} at fewer source columns, or pick a model with a larger context.`,
  };
}

export function modelFilteredError(modelName: string): PulseError {
  return {
    code: 'modelFiltered',
    cause: `${modelName} declined to answer this response.`,
    fix: 'Try another model, or adjust the prompt.',
  };
}

export function modelUnknownError(modelName: string, message: string): PulseError {
  const detail = message.trim().length > 0 ? truncate(message.trim(), MAX_MODEL_MESSAGE_LENGTH) : 'no details';

  return {
    code: 'modelUnknown',
    cause: `${modelName} returned an error: ${detail}`,
    fix: 'Try again; if it persists, try another model.',
  };
}

export function testInputInvalidError(issues: string[]): PulseError {
  return {
    code: 'testInputInvalid',
    cause: issues.join('\n'),
    fix: null,
  };
}

export function testTimedOutError(): PulseError {
  return {
    code: 'testTimedOut',
    cause: 'Testing every column on one response took too long.',
    fix: 'Test again, or test fewer columns.',
  };
}

export function storageUnavailableError(): PulseError {
  return {
    code: 'storageUnavailable',
    cause: 'The survey file storage isn\'t available.',
    fix: 'Try again in a few minutes; if it persists, ask an admin to check the document upload provider.',
  };
}

export function queueUnavailableError(): PulseError {
  return {
    code: 'queueUnavailable',
    cause: 'The analysis queue isn\'t running.',
    fix: 'Try again in a few minutes; if it persists, ask an admin.',
  };
}

export function stoppedUnexpectedlyError(): PulseError {
  return {
    code: 'stoppedUnexpectedly',
    cause: 'The run stopped before it finished.',
    fix: 'Run it again — rows already analyzed won\'t be re-billed.',
  };
}

export function uploadNetworkError(): PulseError {
  return {
    code: 'uploadNetworkError',
    cause: 'The survey upload lost its connection.',
    fix: 'Check your network or VPN and run again.',
  };
}

export function uploadTimedOutError(): PulseError {
  return {
    code: 'uploadTimedOut',
    cause: 'The survey upload took longer than 5 minutes.',
    fix: 'Check your connection, or upload a smaller file.',
  };
}
