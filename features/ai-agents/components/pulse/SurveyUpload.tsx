import { FileInput, Loader, Select, Stack, Text } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';

import type { SurveyLayout } from '@/features/ai-agents/utils/pulse/detectSurveyLayout';
import type { SurveyPreview } from '@/features/ai-agents/utils/pulse/parseSurveyPreview';

const XLSX_ACCEPT = '.xlsx';

type SurveyUploadProps = Readonly<{
  file: File | null;
  layout: SurveyLayout | null;
  preview: SurveyPreview | null;
  error: string | null;
  isLoading?: boolean;
  onFileChange: (file: File | null) => void;
  onSheetChange: (sheetName: string) => void;
}>;

export default function SurveyUpload({
  file,
  layout,
  preview,
  error,
  isLoading,
  onFileChange,
  onSheetChange,
}: SurveyUploadProps) {
  return (
    <Stack spacing='md'>
      <FileInput
        data-testid='pulse-survey-file'
        label='Survey workbook'
        description='Upload Excel file.'
        descriptionProps={{ 'data-testid': 'pulse-survey-file-description' }}
        accept={XLSX_ACCEPT}
        icon={<IconUpload size={18} />}
        value={file}
        onChange={onFileChange}
      />

      {/* Only a workbook with more than one worksheet leaves any doubt about which one to read. */}
      {layout && layout.sheetNames.length > 1 && (
        <Select
          data-testid='pulse-sheet-picker'
          label='Worksheet'
          description='Which sheet holds the responses.'
          data={layout.sheetNames}
          value={layout.sheetName}
          onChange={(value) => value && onSheetChange(value)}
        />
      )}

      {layout && (
        <Text data-testid='pulse-detected-layout' size='sm' c='gray.4'>
          {`Reading worksheet "${layout.sheetName}", with the questions on row ${layout.headerRow}.`}
        </Text>
      )}

      {isLoading && <Loader data-testid='pulse-preview-loading' size='sm' />}

      {!isLoading && error && (
        <Text data-testid='pulse-preview-error' size='sm' c='red.6'>
          {error}
        </Text>
      )}

      {!isLoading && !error && preview && (
        <Stack data-testid='pulse-preview' spacing='xs'>
          <Text data-testid='pulse-preview-count' size='sm' c='gray.4'>
            {`${preview.responseCount} responses found in the columns your prompt matrix reads`}
          </Text>
          <Text data-testid='pulse-preview-scope' size='xs' c='gray.5'>
            {`${preview.headers.length} columns will be read for every response.`}
          </Text>
        </Stack>
      )}
    </Stack>
  );
}
