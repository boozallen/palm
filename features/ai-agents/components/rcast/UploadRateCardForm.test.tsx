import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { v4 } from 'uuid';

import UploadRateCardForm from './UploadRateCardForm';
import { useRcast } from '@/features/ai-agents/hooks/rcast/useRcast';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

jest.mock('@/features/ai-agents/hooks/rcast/useRcast');
jest.mock('@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution', () => ({
  useUserGroupAttribution: jest.fn(),
}));
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

const mockUserGroupAttribution = () => {
  (useUserGroupAttribution as jest.Mock).mockReturnValue({
    gate: jest.fn((_modelId, onSubmit) => onSubmit(undefined)),
    pendingDecision: null,
    defaultUserGroupId: undefined,
    setDefaultUserGroupId: jest.fn(),
    onSelect: jest.fn(),
    onDismiss: jest.fn(),
  });
};

const selectFileAndModel = async (container: HTMLElement) => {
  const file = new File(['test content'], 'test-file.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  // jsdom's File doesn't implement arrayBuffer(); the component reads the file contents on submit.
  file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [file] } });

  const modelSelect = screen.getByPlaceholderText('Select model');
  // Mantine's Select opens and picks on mousedown; a full click event sequence costs ~700ms a call here.
  fireEvent.mouseDown(modelSelect);
  fireEvent.mouseDown(screen.getByText('GPT-4'));
  await waitFor(() => {
    expect(modelSelect).toHaveValue('GPT-4');
  });
};

describe('UploadRateCardForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRcast as jest.Mock).mockReturnValue({
      uploadAndProcessRateCard: mockUploadAndProcessRateCard,
      isProcessing: false,
      jobStatus: 'idle',
    });
    mockUserGroupAttribution();
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

  describe('group attribution', () => {
    it('submits without a group id when the gate resolves with undefined', async () => {
      mockUploadAndProcessRateCard.mockResolvedValue({
        rateCardId: 'rate-card-1',
        jobId: 'job-1',
        message: 'Uploaded',
      });

      const { container } = renderComponent();
      await selectFileAndModel(container);

      fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

      await waitFor(() => {
        expect(mockUploadAndProcessRateCard).toHaveBeenCalledWith(
          expect.objectContaining({ userGroupId: undefined })
        );
      });
    });

    it('passes the resolved group id from the gate into the upload call', async () => {
      (useUserGroupAttribution as jest.Mock).mockReturnValue({
        gate: jest.fn((_modelId, onSubmit) => onSubmit('group-1')),
        pendingDecision: null,
        defaultUserGroupId: undefined,
        setDefaultUserGroupId: jest.fn(),
        onSelect: jest.fn(),
        onDismiss: jest.fn(),
      });
      mockUploadAndProcessRateCard.mockResolvedValue({
        rateCardId: 'rate-card-1',
        jobId: 'job-1',
        message: 'Uploaded',
      });

      const { container } = renderComponent();
      await selectFileAndModel(container);

      fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

      await waitFor(() => {
        expect(mockUploadAndProcessRateCard).toHaveBeenCalledWith(
          expect.objectContaining({ userGroupId: 'group-1' })
        );
      });
    });
  });
});
