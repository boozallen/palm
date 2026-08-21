import { render, screen } from '@testing-library/react';

import Agent from './Agent';

jest.mock('@/features/ai-agents/hooks/prism/usePrism', () => ({
  usePrism: () => ({
    analyzeDocument: jest.fn(),
    reset: jest.fn(),
    isProcessing: false,
    progress: null,
    results: null,
    completedJobId: null,
    error: null,
  }),
}));

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
});
