import { Alert, FileInput, List, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';

import { formatColumnLabel } from '@/features/ai-agents/utils/pulse/columnLetters';
import { MATRIX_MAX_FIELDS, type PromptMatrixRowError } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import { parsePulseErrorMessage } from '@/features/ai-agents/utils/pulse/pulseErrors';
import type { SurveyPreview } from '@/features/ai-agents/utils/pulse/parseSurveyPreview';
import summarizeSourceColumns, { type SourceColumnSummary } from '@/features/ai-agents/utils/pulse/summarizeSourceColumns';
import type { PulseFieldConfig } from '@/features/ai-agents/types/pulse/surveyAnalysis';

// A source the survey doesn't have a header for is named by its letter alone.
function sourceLabel(source: SourceColumnSummary): string {
  return source.header === null ? source.column : formatColumnLabel(source.column, source.header);
}

type PromptMatrixUploadProps = Readonly<{
  file: File | null;
  fields: PulseFieldConfig[];
  rowErrors: PromptMatrixRowError[];
  fileError: string | null;
  isLoading?: boolean;
  preview: SurveyPreview | null;
  onFileChange: (file: File | null) => void;
}>;

export default function PromptMatrixUpload({
  file,
  fields,
  rowErrors,
  fileError,
  isLoading = false,
  preview,
  onFileChange,
}: PromptMatrixUploadProps) {
  /**
   * Every source column any row names, so one warning covers a column two rows share. A column
   * the survey doesn't have is left to the missing-source warning rather than counted as empty.
   */
  const sparseSources = useMemo(
    () => summarizeSourceColumns(
      Array.from(new Set(fields.flatMap((field) => field.inputColumnRefs))),
      preview?.headers ?? [],
      preview?.rows ?? [],
    ).filter((source) => source.isSparse && source.header !== null),
    [fields, preview],
  );

  /**
   * Sources the uploaded survey has no column for, named with the matrix column that reads them.
   * Only meaningful once a survey is loaded: without one, every source looks missing.
   */
  const missingSources = useMemo(() => {
    if (preview === null) {
      return [];
    }

    return fields.flatMap((field) => field.inputColumnRefs
      .filter((column) => !preview.headers.some((header) => header.column === column))
      .map((column) => ({ fieldName: field.fieldName, column })));
  }, [fields, preview]);

  const fileInputProps: React.ComponentPropsWithoutRef<'input'> & { 'data-testid': string } = {
    'data-testid': 'pulse-matrix-file-input',
    disabled: isLoading,
  };

  return (
    <Stack spacing='md'>
      <FileInput
        accept='.xlsx'
        disabled={isLoading}
        label='Prompt matrix'
        description='Upload Excel file.'
        descriptionProps={{ 'data-testid': 'pulse-matrix-file-description' }}
        value={file}
        onChange={onFileChange}
        fileInputProps={fileInputProps}
      />

      {fileError && (
        <Alert color='red' data-testid='pulse-matrix-file-error'>
          {fileError}
        </Alert>
      )}

      {rowErrors.length > 0 && (
        <Alert color='yellow' title='Some rows were skipped'>
          <List size='sm'>
            {rowErrors.map((error) => {
              const { cause, fix } = parsePulseErrorMessage(error.message);

              return (
                <List.Item data-testid='pulse-matrix-row-error' key={`${error.row}-${error.message}`}>
                  <Text size='sm'>{`Row ${error.row}: ${cause}`}</Text>
                  {fix && <Text size='sm' c='gray.4'>{`Fix: ${fix}`}</Text>}
                </List.Item>
              );
            })}
          </List>
        </Alert>
      )}

      {sparseSources.length > 0 && (
        <Alert color='yellow' title='Some source columns are mostly empty'>
          <List size='sm'>
            {sparseSources.map((source) => (
              <List.Item data-testid='pulse-matrix-sparse-source' key={source.column}>
                {`${sourceLabel(source)} was answered by ${source.answered} of ${source.total} responses, so the columns reading it will be mostly empty too.`}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}

      {missingSources.length > 0 && (
        <Alert color='yellow' title='Some source columns are missing from this survey'>
          <List size='sm'>
            {missingSources.map((source) => (
              <List.Item data-testid='pulse-matrix-missing-source' key={`${source.fieldName}-${source.column}`}>
                {`${source.fieldName} reads column ${source.column}, which this survey does not have, so it will have nothing to read.`}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}

      {fields.length > 0 && (
        <Text data-testid='pulse-matrix-summary' size='sm' c='gray.4'>
          {`${fields.length} of ${MATRIX_MAX_FIELDS} columns will be added to every response.`}
        </Text>
      )}
    </Stack>
  );
}
