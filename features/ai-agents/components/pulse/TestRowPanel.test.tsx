import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TestRowPanel from '@/features/ai-agents/components/pulse/TestRowPanel';
import useTestPulseRow from '@/features/ai-agents/api/pulse/test-pulse-row';
import {
  PulseFieldType,
  type ParsedSurveyRow,
  type PulseFieldConfig,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/features/ai-agents/api/pulse/test-pulse-row');
jest.mock('@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution', () => ({
  useUserGroupAttribution: () => ({ gate: mockGate }),
}));
jest.mock('@/features/ai-agents/utils/pulse/showPulseError', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import showPulseError from '@/features/ai-agents/utils/pulse/showPulseError';

const mockMutateAsync = jest.fn();
const mockGate = jest.fn();
const mockHook = useTestPulseRow as jest.Mock;
const mockShowPulseError = showPulseError as jest.Mock;

const fields: PulseFieldConfig[] = [{
  fieldName: 'Sentiment',
  prompt: 'Judge sentiment.',
  fieldType: PulseFieldType.CATEGORY,
  allowedValues: ['Positive', 'Negative'],
  defaultValue: 'Positive',
  inputColumnRefs: [],
  sortOrder: 0,
}];

const rows: ParsedSurveyRow[] = [
  {
    rowNumber: 2,
    cells: { B: { column: 'B', header: 'What did you like?', value: 'The advice column' } },
    responseText: 'What did you like?:\nThe advice column',
  },
  {
    rowNumber: 3,
    cells: { B: { column: 'B', header: 'What did you like?', value: 'Nothing' } },
    responseText: 'What did you like?:\nNothing',
  },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof TestRowPanel>> = {}) {
  const props = {
    agentId: 'agent-1',
    modelId: 'claude-opus-5',
    persona: 'You are a survey analyst.',
    fields,
    rows,
    disabledReason: null as string | null,
    ...overrides,
  };

  render(<TestRowPanel {...props} />);

  return props;
}

describe('TestRowPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockResolvedValue({
      values: [
        { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false, failureReason: null },
      ],
    });
    mockHook.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    mockGate.mockImplementation(async (_modelId: string, onSubmit: (userGroupId: string | undefined) => Promise<void>) => {
      await onSubmit('group-1');
      return true;
    });
  });

  it('attributes the test run to the user group chosen for the model', async () => {
    renderPanel();

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    expect(mockGate).toHaveBeenCalledWith('claude-opus-5', expect.any(Function));
    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ userGroupId: 'group-1' }));
  });

  it('does not run the test when the user dismisses the group choice', async () => {
    mockGate.mockResolvedValue(false);
    renderPanel();

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('lets the user pick a row and run it', async () => {
    renderPanel();

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ rowNumber: 2 }));
  });

  it('sends the matrix as it is currently on screen', async () => {
    renderPanel();

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      fields,
      persona: 'You are a survey analyst.',
    }));
  });

  it('sends no response guidelines with a test run', async () => {
    renderPanel();

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty('responseGuidelines');
  });

  it('shows the derived value for each column', async () => {
    renderPanel();

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    await waitFor(() => {
      expect(screen.getAllByTestId('pulse-test-result')).toHaveLength(1);
    });
  });

  it('marks a value that fell back to its default and says why', async () => {
    mockMutateAsync.mockResolvedValue({
      values: [{
        fieldName: 'Sentiment',
        value: 'Positive',
        wasDefaulted: true,
        failureReason: 'Value "Mostly positive" is not one of: Positive, Negative',
      }],
    });

    renderPanel();

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    await waitFor(() => {
      expect(screen.getByTestId('pulse-test-defaulted')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pulse-test-failure-reason')).toBeInTheDocument();
  });

  it('cannot be run until the survey and matrix are ready', () => {
    renderPanel({ disabledReason: 'Upload a survey file first.' });

    expect(screen.getByTestId('pulse-test-run')).toBeDisabled();
    expect(screen.getByTestId('pulse-test-disabled-reason')).toBeInTheDocument();
  });

  it('shows nothing before the first run', () => {
    renderPanel();

    expect(screen.queryByTestId('pulse-test-result')).not.toBeInTheDocument();
  });

  it('clears results and shows the cause and fix when a run fails', async () => {
    mockMutateAsync
      .mockResolvedValueOnce({
        values: [
          { fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false, failureReason: null },
        ],
      })
      .mockRejectedValueOnce(new Error('Extraction failed'));

    renderPanel();

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    await waitFor(() => {
      expect(screen.getByTestId('pulse-test-result')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    await waitFor(() => {
      expect(screen.queryByTestId('pulse-test-result')).not.toBeInTheDocument();
    });

    expect(mockShowPulseError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Extraction failed' }), 'Test failed');
    expect(screen.getByTestId('pulse-test-run')).toBeEnabled();
  });

  it('clears results when the selected row changes', async () => {
    renderPanel();

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    await waitFor(() => {
      expect(screen.getByTestId('pulse-test-result')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByTestId('pulse-test-row'));
    fireEvent.mouseDown(screen.getByText('Row 3'));

    expect(screen.queryByTestId('pulse-test-result')).not.toBeInTheDocument();
  });

  const baseProps = {
    agentId: 'agent-1',
    modelId: 'claude-opus-5',
    persona: 'You are a survey analyst.',
    fields,
    rows,
    disabledReason: null as string | null,
  };

  it('clears the result once the matrix it describes changes', async () => {
    const { rerender } = render(<TestRowPanel {...baseProps} />);

    await userEvent.click(screen.getByTestId('pulse-test-run'));
    await waitFor(() => expect(screen.getByTestId('pulse-test-result')).toBeInTheDocument());

    const editedFields = [{ ...fields[0], prompt: 'Judge sentiment differently.' }];
    rerender(<TestRowPanel {...baseProps} fields={editedFields} />);

    expect(screen.queryByTestId('pulse-test-result')).not.toBeInTheDocument();
  });

  it('ignores a response for a matrix the user has since changed', async () => {
    let resolveRun: (result: unknown) => void = () => {};
    mockMutateAsync.mockImplementationOnce(() => new Promise((resolve) => { resolveRun = resolve; }));

    const { rerender } = render(<TestRowPanel {...baseProps} />);

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    const editedFields = [{ ...fields[0], prompt: 'Judge sentiment differently.' }];
    rerender(<TestRowPanel {...baseProps} fields={editedFields} />);

    await act(async () => {
      resolveRun({
        values: [{ fieldName: 'Sentiment', value: 'Positive', wasDefaulted: false, failureReason: null }],
      });
    });

    expect(screen.queryByTestId('pulse-test-result')).not.toBeInTheDocument();
  });

  it('runs a valid row after the selected row no longer exists', async () => {
    const { rerender } = render(<TestRowPanel {...baseProps} />);

    fireEvent.mouseDown(screen.getByTestId('pulse-test-row'));
    fireEvent.mouseDown(screen.getByText('Row 3'));

    const shiftedRows: ParsedSurveyRow[] = [
      {
        rowNumber: 6,
        cells: { B: { column: 'B', header: 'What did you like?', value: 'The advice column' } },
        responseText: 'What did you like?:\nThe advice column',
      },
      {
        rowNumber: 7,
        cells: { B: { column: 'B', header: 'What did you like?', value: 'Nothing' } },
        responseText: 'What did you like?:\nNothing',
      },
    ];
    rerender(<TestRowPanel {...baseProps} rows={shiftedRows} />);

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ rowNumber: 6 }));
  });

  it('offers every response to test, not just the first few', async () => {
    const manyRows: ParsedSurveyRow[] = Array.from({ length: 5 }, (_, index) => ({
      rowNumber: index + 2,
      cells: { B: { column: 'B', header: 'What did you like?', value: `Answer ${index}` } },
      responseText: `What did you like?:\nAnswer ${index}`,
    }));

    renderPanel({ rows: manyRows });

    fireEvent.mouseDown(screen.getByTestId('pulse-test-row'));

    expect(screen.getAllByRole('option')).toHaveLength(5);
  });

  it('defaults to the first row when rows arrive after mount', async () => {
    const { rerender } = render(
      <TestRowPanel
        agentId='agent-1'
        modelId='claude-opus-5'
        persona='You are a survey analyst.'
        fields={fields}
        rows={[]}
        disabledReason={null}
      />
    );

    rerender(
      <TestRowPanel
        agentId='agent-1'
        modelId='claude-opus-5'
        persona='You are a survey analyst.'
        fields={fields}
        rows={rows}
        disabledReason={null}
      />
    );

    await userEvent.click(screen.getByTestId('pulse-test-run'));

    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ rowNumber: 2 }));
  });
});
