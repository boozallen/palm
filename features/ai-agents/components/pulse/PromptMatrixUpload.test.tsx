import { fireEvent, render, screen } from '@testing-library/react';

import PromptMatrixUpload from '@/features/ai-agents/components/pulse/PromptMatrixUpload';
import { PulseFieldType, type PulseFieldConfig } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import { MATRIX_FALLBACK_VALUE, type PromptMatrixRowError } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import type { SurveyPreview } from '@/features/ai-agents/utils/pulse/parseSurveyPreview';

const FIELD: PulseFieldConfig = {
  fieldName: 'Sentiment',
  prompt: 'Choose how they feel.',
  fieldType: PulseFieldType.CATEGORY,
  allowedValues: ['Positive', 'Negative'],
  defaultValue: MATRIX_FALLBACK_VALUE,
  inputColumnRefs: ['B'],
  sortOrder: 0,
};

function previewWith(...answers: string[]): SurveyPreview {
  return {
    responseCount: answers.length,
    headers: [
      { column: 'B', header: 'What did you think?', value: '' },
      { column: 'C', header: 'Revenue', value: '' },
    ],
    rows: answers.map((value, index) => ({
      rowNumber: index + 2,
      cells: {
        B: { column: 'B', header: 'What did you think?', value },
        C: { column: 'C', header: 'Revenue', value: '100' },
      },
      responseText: value,
    })),
  };
}

type RenderProps = {
  file?: File | null;
  fields?: PulseFieldConfig[];
  rowErrors?: PromptMatrixRowError[];
  fileError?: string | null;
  isLoading?: boolean;
  preview?: SurveyPreview | null;
  onFileChange?: (file: File | null) => void;
};

const BASE_PROPS = {
  file: null as File | null,
  fields: [] as PulseFieldConfig[],
  rowErrors: [] as PromptMatrixRowError[],
  fileError: null as string | null,
  preview: null as SurveyPreview | null,
  onFileChange: jest.fn(),
};

function renderUpload(props: RenderProps = {}) {
  return render(<PromptMatrixUpload {...BASE_PROPS} {...props} />);
}

describe('PromptMatrixUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('describes the file it accepts', () => {
    renderUpload();

    expect(screen.getByTestId('pulse-matrix-file-description')).toHaveTextContent('Upload Excel file.');
  });

  it('no longer offers the template downloads, which live in the first step', () => {
    renderUpload({ fields: [FIELD] });

    expect(screen.queryByTestId('pulse-matrix-template-download')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pulse-matrix-last-run-download')).not.toBeInTheDocument();
  });

  it('reports the chosen file back to the parent', () => {
    const onFileChange = jest.fn();
    const file = new File(['x'], 'matrix.xlsx');

    renderUpload({ onFileChange });
    fireEvent.change(screen.getByTestId('pulse-matrix-file-input'), { target: { files: [file] } });

    expect(onFileChange).toHaveBeenCalledWith(file);
  });

  it('lists no table of the parsed columns', () => {
    renderUpload({
      file: new File(['x'], 'matrix.xlsx'),
      fields: [FIELD, { ...FIELD, fieldName: 'Concern', sortOrder: 1 }],
      preview: previewWith('Loved it', 'Fine'),
    });

    expect(screen.queryByTestId('pulse-matrix-preview-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pulse-matrix-sources-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pulse-matrix-preview-name-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pulse-matrix-preview-prompt-0')).not.toBeInTheDocument();
  });

  it('warns, by column label, when a source column is one most responses left blank', () => {
    renderUpload({
      file: new File(['x'], 'matrix.xlsx'),
      fields: [FIELD],
      preview: previewWith('Loved it', '', '', ''),
    });

    expect(screen.getByTestId('pulse-matrix-sparse-source')).toHaveTextContent('B – What did you think?');
  });

  it('warns about a column two output columns share only once', () => {
    renderUpload({
      file: new File(['x'], 'matrix.xlsx'),
      fields: [FIELD, { ...FIELD, fieldName: 'Concern', sortOrder: 1 }],
      preview: previewWith('Loved it', '', '', ''),
    });

    expect(screen.getAllByTestId('pulse-matrix-sparse-source')).toHaveLength(1);
  });

  it('says nothing about answer rates before a survey is uploaded', () => {
    renderUpload({ file: new File(['x'], 'matrix.xlsx'), fields: [FIELD] });

    expect(screen.queryByTestId('pulse-matrix-sparse-source')).not.toBeInTheDocument();
  });

  it('names the column and the letter when a source is not in the survey', () => {
    renderUpload({
      file: new File(['x'], 'matrix.xlsx'),
      fields: [{ ...FIELD, inputColumnRefs: ['Z'] }],
      preview: previewWith('Loved it', 'Fine'),
    });

    const warning = screen.getByTestId('pulse-matrix-missing-source');

    expect(warning).toHaveTextContent('Sentiment');
    expect(warning).toHaveTextContent('column Z');
  });

  it('reports a missing source as missing rather than as mostly empty', () => {
    renderUpload({
      file: new File(['x'], 'matrix.xlsx'),
      fields: [{ ...FIELD, inputColumnRefs: ['Z'] }],
      preview: previewWith('Loved it', 'Fine'),
    });

    expect(screen.queryByTestId('pulse-matrix-sparse-source')).not.toBeInTheDocument();
  });

  it('says nothing about missing sources before a survey is uploaded', () => {
    renderUpload({ file: new File(['x'], 'matrix.xlsx'), fields: [{ ...FIELD, inputColumnRefs: ['Z'] }] });

    expect(screen.queryByTestId('pulse-matrix-missing-source')).not.toBeInTheDocument();
  });

  it('says nothing about missing sources for a column that reads the whole response', () => {
    renderUpload({
      file: new File(['x'], 'matrix.xlsx'),
      fields: [{ ...FIELD, inputColumnRefs: [] }],
      preview: previewWith('Loved it', 'Fine'),
    });

    expect(screen.queryByTestId('pulse-matrix-missing-source')).not.toBeInTheDocument();
  });

  it('shows the whole-file problem when the workbook is unusable', () => {
    renderUpload({ file: new File(['x'], 'matrix.xlsx'), fileError: 'The prompt matrix has no rows below its header.' });

    expect(screen.getByTestId('pulse-matrix-file-error')).toHaveTextContent('no rows below its header');
  });

  it('lists every bad row with its row number', () => {
    renderUpload({
      file: new File(['x'], 'matrix.xlsx'),
      fields: [FIELD],
      rowErrors: [
        { row: 3, message: 'This row has no column name.' },
        { row: 7, message: '\'Nonexistent\' doesn\'t match any survey column.' },
      ],
    });

    const errors = screen.getAllByTestId('pulse-matrix-row-error');

    expect(errors).toHaveLength(2);
    expect(errors[0]).toHaveTextContent('Row 3');
    expect(errors[1]).toHaveTextContent('Row 7');
  });

  it('shows how many columns will run alongside the cap', () => {
    renderUpload({ file: new File(['x'], 'matrix.xlsx'), fields: [FIELD] });

    expect(screen.getByTestId('pulse-matrix-summary')).toHaveTextContent('1');
    expect(screen.getByTestId('pulse-matrix-summary')).toHaveTextContent('25');
  });

  it('disables the file input while a run is starting', () => {
    renderUpload({ isLoading: true });

    expect(screen.getByTestId('pulse-matrix-file-input')).toBeDisabled();
  });
});
