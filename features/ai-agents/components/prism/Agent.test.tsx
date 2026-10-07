import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import Agent from './Agent';
import { usePrism } from '@/features/ai-agents/hooks/prism/usePrism';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';
import type { PrismFormValues } from './Form';

jest.mock('@/features/ai-agents/hooks/prism/usePrism', () => ({
  usePrism: jest.fn(),
}));

jest.mock('@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution', () => ({
  useUserGroupAttribution: jest.fn(),
}));

jest.mock('./Form', () => {
  return function MockForm({
    onSubmit,
  }: { onSubmit: (values: PrismFormValues) => void }) {
    return (
      <button
        data-testid='mock-form-submit'
        onClick={() => onSubmit({
          requirementsFile: new File(['req'], 'requirements.xlsx'),
          proposalFile: new File(['prop'], 'proposal.pdf'),
          model: 'model-1',
        })}
      >
        Submit
      </button>
    );
  };
});

jest.mock('@/features/ai-agents/api/prism/get-prism-jobs', () => ({
  __esModule: true,
  default: () => ({
    data: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/features/ai-agents/api/prism/get-prism-results', () => ({
  __esModule: true,
  default: () => ({
    data: null,
  }),
}));

jest.mock('@/features/shared/api/get-available-models', () => ({
  __esModule: true,
  default: () => ({
    data: {
      availableModels: [
        { id: 'model-1', name: 'Claude 3.5 Sonnet', providerLabel: 'Anthropic' },
      ],
    },
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
      eachRow: jest.fn(),
    }),
    xlsx: {
      writeBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    },
  })),
}));

describe('PRISM Agent', () => {
  const mockAgentId = 'd59a6bfa-fe00-496e-9854-30c49f5d7588';
  const mockAnalyzeDocument = jest.fn();

  const mockUsePrismReturn = {
    analyzeDocument: mockAnalyzeDocument,
    reset: jest.fn(),
    isProcessing: false,
    progress: null,
    results: null,
    completedJobId: null,
    error: null,
  };

  const mockUserGroupAttributionReturn = {
    gate: jest.fn((_modelId, onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => onSubmit(undefined)),
    pendingDecision: null,
    defaultUserGroupId: undefined,
    setDefaultUserGroupId: jest.fn(),
    onSelect: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (usePrism as jest.Mock).mockReturnValue(mockUsePrismReturn);
    (useUserGroupAttribution as jest.Mock).mockReturnValue(mockUserGroupAttributionReturn);
  });

  it('renders the title', () => {
    render(<Agent id={mockAgentId} />);

    expect(screen.getByText('Proposal Compliance Analysis')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<Agent id={mockAgentId} />);

    expect(
      screen.getByText('Upload a requirements spreadsheet and proposal document to evaluate compliance.'),
    ).toBeInTheDocument();
  });

  it('renders the Analyze Proposal accordion', () => {
    render(<Agent id={mockAgentId} />);

    expect(screen.getByText('Analyze Proposal')).toBeInTheDocument();
  });

  it('renders empty state when no completed jobs', () => {
    render(<Agent id={mockAgentId} />);

    expect(
      screen.getByText('Upload documents to begin compliance analysis'),
    ).toBeInTheDocument();
  });

  it('does not render results panel when no completed jobs', () => {
    render(<Agent id={mockAgentId} />);

    expect(screen.queryByText('Compliance Results')).not.toBeInTheDocument();
  });

  it('submits the analysis without a userGroupId when there is nothing to attribute', async () => {
    render(<Agent id={mockAgentId} />);

    fireEvent.click(screen.getByTestId('mock-form-submit'));

    await waitFor(() => {
      expect(mockAnalyzeDocument).toHaveBeenCalledWith(
        expect.objectContaining({ userGroupId: undefined }),
      );
    });
  });

  it('passes the resolved group attribution choice to analyzeDocument', async () => {
    (useUserGroupAttribution as jest.Mock).mockReturnValue({
      ...mockUserGroupAttributionReturn,
      gate: jest.fn((_modelId, onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => onSubmit('group-1')),
    });

    render(<Agent id={mockAgentId} />);

    fireEvent.click(screen.getByTestId('mock-form-submit'));

    await waitFor(() => {
      expect(mockAnalyzeDocument).toHaveBeenCalledWith(
        expect.objectContaining({ userGroupId: 'group-1' }),
      );
    });
  });
});
