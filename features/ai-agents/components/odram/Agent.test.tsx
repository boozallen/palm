import { render, screen, fireEvent, act } from '@testing-library/react';

import Agent from './Agent';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

const mockStartOdramAnalysis = jest.fn();

jest.mock('@/features/ai-agents/hooks/odram/useOdram', () => ({
  useOdram: () => ({
    startOdramAnalysis: mockStartOdramAnalysis,
    reset: jest.fn(),
    isProcessing: false,
    progress: '',
    currentQuestion: undefined,
    totalQuestions: undefined,
    partialResults: [],
    results: null,
    completedJobId: null,
    error: null,
  }),
}));

jest.mock('@/features/ai-agents/api/odram/get-odram-jobs', () => ({
  __esModule: true,
  default: () => ({
    data: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/features/ai-agents/api/odram/get-odram-results', () => ({
  __esModule: true,
  default: () => ({
    data: null,
  }),
}));

jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    addWorksheet: jest.fn().mockReturnValue({
      columns: [],
      getRow: jest.fn().mockReturnValue({ eachCell: jest.fn() }),
      addRow: jest.fn(),
      getColumn: jest.fn().mockReturnValue({}),
    }),
    xlsx: {
      writeBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    },
  })),
}));

jest.mock('@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution', () => ({
  useUserGroupAttribution: jest.fn(),
}));

const mockFormValues = {
  promptMatrixFile: new File(['matrix'], 'matrix.xlsx'),
  odramFile: new File(['odram'], 'odram.pdf'),
  proposalFiles: [new File(['proposal'], 'proposal.pdf')],
  model: 'model-id',
  documentMapping: null,
  questionContext: null,
};

jest.mock('./Form', () => {
  return jest.fn(({ onSubmit }) => (
    <button onClick={() => onSubmit(mockFormValues)}>ODRAM Form</button>
  ));
});

const defaultUserGroupAttribution = {
  gate: jest.fn((_modelId, onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => onSubmit(undefined)),
  pendingDecision: null,
  defaultUserGroupId: undefined,
  setDefaultUserGroupId: jest.fn(),
  onSelect: jest.fn(),
  onDismiss: jest.fn(),
};

describe('ODRAM Agent', () => {
  const mockAgentId = 'd59a6bfa-fe00-496e-9854-30c49f5d7588';

  beforeEach(() => {
    jest.clearAllMocks();
    (useUserGroupAttribution as jest.Mock).mockReturnValue(defaultUserGroupAttribution);
  });

  it('renders the title', () => {
    render(<Agent id={mockAgentId} />);

    expect(screen.getByText('ODRAM Risk Assessment')).toBeInTheDocument();
  });

  it('renders empty state when no completed jobs', () => {
    render(<Agent id={mockAgentId} />);

    expect(
      screen.getByText('Upload ODRAM responses and proposal documents to get started'),
    ).toBeInTheDocument();
  });

  it('starts the analysis with no group attribution when the gate resolves undefined', async () => {
    render(<Agent id={mockAgentId} />);

    await act(async () => {
      fireEvent.click(screen.getByText('ODRAM Form'));
    });

    expect(mockStartOdramAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ userGroupId: undefined }),
    );
  });

  it('passes the resolved group id from the gate into the analysis mutation', async () => {
    (useUserGroupAttribution as jest.Mock).mockReturnValue({
      ...defaultUserGroupAttribution,
      gate: jest.fn((_modelId, onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => onSubmit('group-1')),
    });

    render(<Agent id={mockAgentId} />);

    await act(async () => {
      fireEvent.click(screen.getByText('ODRAM Form'));
    });

    expect(mockStartOdramAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ userGroupId: 'group-1' }),
    );
  });
});
