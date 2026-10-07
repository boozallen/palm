import { fireEvent, render, screen } from '@testing-library/react';

import SurveyUpload from './SurveyUpload';
import type { SurveyLayout } from '@/features/ai-agents/utils/pulse/detectSurveyLayout';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const layout: SurveyLayout = {
  sheetName: 'Feedback',
  headerRow: 1,
  columns: ['A', 'B', 'C'],
  headers: [
    { letter: 'A', header: 'ID' },
    { letter: 'B', header: 'What did you like?' },
    { letter: 'C', header: 'How often do you read it?' },
  ],
  sheetNames: ['Feedback'],
};

const preview = {
  responseCount: 120,
  headers: [
    { column: 'B', header: 'What did you like?', value: '' },
    { column: 'C', header: 'How often do you read it?', value: '' },
  ],
  rows: [
    {
      rowNumber: 2,
      cells: {
        B: { column: 'B', header: 'What did you like?', value: 'The advice column' },
      },
      responseText: 'What did you like?:\nThe advice column',
    },
  ],
};

function renderUpload(overrides: Partial<React.ComponentProps<typeof SurveyUpload>> = {}) {
  const props = {
    file: null as File | null,
    layout: null as SurveyLayout | null,
    preview: null as typeof preview | null,
    error: null as string | null,
    onFileChange: jest.fn(),
    onSheetChange: jest.fn(),
    ...overrides,
  };

  render(<SurveyUpload {...props} />);

  return props;
}

describe('SurveyUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks only for the survey workbook', () => {
    renderUpload();

    expect(screen.getByTestId('pulse-survey-file')).toBeInTheDocument();
    expect(screen.queryByTestId('pulse-detected-layout')).not.toBeInTheDocument();
  });

  it('describes the file it accepts', () => {
    renderUpload();

    expect(screen.getByTestId('pulse-survey-file-description')).toHaveTextContent('Upload Excel file.');
  });

  it('reports the worksheet and header row read off the upload', () => {
    renderUpload({ file: new File([''], 'symposium.xlsx'), layout });

    expect(screen.getByTestId('pulse-detected-layout')).toHaveTextContent('Feedback');
    expect(screen.getByTestId('pulse-detected-layout')).toHaveTextContent('row 1');
  });

  it('offers no worksheet choice when the workbook has only one', () => {
    renderUpload({ file: new File([''], 'symposium.xlsx'), layout });

    expect(screen.queryByTestId('pulse-sheet-picker')).not.toBeInTheDocument();
  });

  it('offers a worksheet choice when the workbook has more than one', () => {
    renderUpload({
      file: new File([''], 'symposium.xlsx'),
      layout: { ...layout, sheetNames: ['Feedback', 'Round two'] },
    });

    expect(screen.getByTestId('pulse-sheet-picker')).toHaveValue('Feedback');
  });

  it('reports the worksheet the user picks', () => {
    const { onSheetChange } = renderUpload({
      file: new File([''], 'symposium.xlsx'),
      layout: { ...layout, sheetNames: ['Feedback', 'Round two'] },
    });

    fireEvent.mouseDown(screen.getByTestId('pulse-sheet-picker'));
    fireEvent.mouseDown(screen.getByText('Round two'));

    expect(onSheetChange).toHaveBeenCalledWith('Round two');
  });

  it('shows nothing to preview until a file is read', () => {
    renderUpload();

    expect(screen.queryByTestId('pulse-preview')).not.toBeInTheDocument();
  });

  it('shows how many responses were found', () => {
    renderUpload({ file: new File([''], 'symposium.xlsx'), layout, preview });

    expect(screen.getByTestId('pulse-preview')).toBeInTheDocument();
    expect(screen.getByTestId('pulse-preview-count')).toHaveTextContent('120');
  });

  it('says how many columns each response will be read from', () => {
    renderUpload({ file: new File([''], 'symposium.xlsx'), layout, preview });

    expect(screen.getByTestId('pulse-preview-scope')).toHaveTextContent('2 columns');
  });

  it('shows no sample of the responses themselves', () => {
    renderUpload({ file: new File([''], 'symposium.xlsx'), layout, preview });

    expect(screen.queryByTestId('pulse-preview-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pulse-preview-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pulse-preview-empty-cell')).not.toBeInTheDocument();
  });

  it('shows a parse error instead of a preview', () => {
    renderUpload({
      file: new File([''], 'symposium.xlsx'),
      error: 'This workbook has no worksheet with any data.',
    });

    expect(screen.getByTestId('pulse-preview-error')).toBeInTheDocument();
    expect(screen.queryByTestId('pulse-preview')).not.toBeInTheDocument();
  });

  it('while loading, the preview is not rendered and the loader is', () => {
    renderUpload({ file: new File([''], 'symposium.xlsx'), layout, preview, isLoading: true });

    expect(screen.queryByTestId('pulse-preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('pulse-preview-loading')).toBeInTheDocument();
  });

  it('while loading, an error is not rendered either', () => {
    renderUpload({ error: 'Parse failed', isLoading: true });

    expect(screen.queryByTestId('pulse-preview-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('pulse-preview-loading')).toBeInTheDocument();
  });
});
