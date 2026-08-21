import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { v4 } from 'uuid';

import UploadRateCardForm from './UploadRateCardForm';
import { useRcast } from '@/features/ai-agents/hooks/rcast/useRcast';

jest.mock('@/features/ai-agents/hooks/rcast/useRcast');
jest.mock('./RateCardTable', () => {
  return function MockRateCardTable() {
    return <div data-testid='rate-card-table'>Rate Card Table</div>;
  };
});

jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

jest.mock('@/features/shared/api/get-available-models', () => ({
  __esModule: true,
  default: () => ({
    data: {
      availableModels: [
        { id: 'model-1', name: 'GPT-4', providerLabel: 'OpenAI' },
        { id: 'model-2', name: 'Claude', providerLabel: 'Anthropic' },
      ],
    },
  }),
}));

const mockAgentId = v4();

const renderComponent = () => {
  return render(<UploadRateCardForm aiAgentId={mockAgentId} />);
};

const mockUploadAndProcessRateCard = jest.fn();

describe('UploadRateCardForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRcast as jest.Mock).mockReturnValue({
      uploadAndProcessRateCard: mockUploadAndProcessRateCard,
      isProcessing: false,
      jobStatus: 'idle',
    });
  });

  it('renders file input and upload button', () => {
    renderComponent();

    expect(screen.getByText(/File Upload/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });

  it('renders file input', () => {
    renderComponent();

    expect(screen.getByText(/File Upload/i)).toBeInTheDocument();
  });

  it('renders upload button', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });

  it('renders upload button with correct props', () => {
    renderComponent();

    const uploadButton = screen.getByRole('button', { name: 'Upload' });

    expect(uploadButton).toHaveAttribute('type', 'submit');
    expect(uploadButton).toBeInTheDocument();
  });

  it('handles file selection', async () => {
    const { container } = renderComponent();

    const file = new File(['test content'], 'test-file.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(fileInput).toBeInTheDocument();
    });
  });

  it('file input is marked as required', () => {
    renderComponent();

    const fileInputLabel = screen.getByText(/File Upload/i);

    expect(fileInputLabel.parentElement?.textContent).toContain('*');
  });

  it('accepts correct file types', () => {
    const { container } = renderComponent();

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    expect(fileInput).toHaveAttribute(
      'accept',
      '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'
    );
  });

  it('shows loading state during upload', () => {
    (useRcast as jest.Mock).mockReturnValue({
      uploadAndProcessRateCard: mockUploadAndProcessRateCard,
      isProcessing: true,
      jobStatus: 'processing',
    });

    renderComponent();

    const button = screen.getByRole('button', { name: 'Upload' });
    expect(button).toBeDisabled();
  });

  describe('job status alerts', () => {
    it('shows processing alert when job is processing', () => {
      (useRcast as jest.Mock).mockReturnValue({
        uploadAndProcessRateCard: mockUploadAndProcessRateCard,
        isProcessing: true,
        jobStatus: 'processing',
      });

      renderComponent();

      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(
        screen.getByText(/Your rate card is being analyzed/)
      ).toBeInTheDocument();
    });

    it('shows error alert when job fails', () => {
      (useRcast as jest.Mock).mockReturnValue({
        uploadAndProcessRateCard: mockUploadAndProcessRateCard,
        isProcessing: false,
        jobStatus: 'error',
      });

      renderComponent();

      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(
        screen.getByText('An error occurred during processing.')
      ).toBeInTheDocument();
    });
  });
});
