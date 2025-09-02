import { UseFormReturnType, useForm } from '@mantine/form';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ModelInput from './ModelInput';
import useGetModels from '@/features/settings/api/ai-providers/get-models';
import { AnalyticsQuery, InitiatedBy, TimeRange } from '@/features/settings/types/analytics';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/form', () => ({
  useForm: () => ({
    getInputProps: jest.fn().mockReturnValue({
      value: '',
      onChange: jest.fn(),
    }),
    values: {
      aiProvider: 'all',
      model: 'all',
    },
    setFieldValue: jest.fn(),
  }),
}));

jest.mock('@/features/settings/api/ai-providers/get-models');

describe('ModelInput', () => {

  const mockForm: UseFormReturnType<AnalyticsQuery> = useForm<AnalyticsQuery>({
    initialValues: {
      initiatedBy: InitiatedBy.Any,
      aiProvider: 'all',
      model: 'all',
      timeRange: TimeRange.Month,
    },
    validate: jest.fn(),
  });

  const modelResults = {
    models: [
      { id: '1', name: 'GPT 4o', externalId: 'gpt-4o', aiProviderId: '1' },
      { id: '2', name: 'GPT 3.5 Turbo', externalId: 'gpt-3.5-turbo', aiProviderId: '1' },
      { id: '3', name: 'GPT 4 Turbo', externalId: 'gpt-4-turbo', aiProviderId: '1' },
    ],
  };

  beforeEach(() => {
    (useGetModels as jest.Mock).mockReturnValue({ data: modelResults });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders ModelInput', () => {
    render(<ModelInput form={mockForm} />);

    const modelInput = screen.queryByLabelText('Model');
    expect(modelInput).toBeInTheDocument();
    expect(modelInput).toHaveAttribute('placeholder', 'Select model');
  });

  it('disables model if ai provider value is all', () => {
    render(<ModelInput form={mockForm} />);

    const modelInput = screen.getByLabelText('Model');

    expect(modelInput).toBeDisabled();

  });

  it('displays all models', async () => {
    const mockForm: UseFormReturnType<AnalyticsQuery> = useForm<AnalyticsQuery>({
      initialValues: {
        initiatedBy: InitiatedBy.Any,
        aiProvider: 'all',
        model: 'all',
        timeRange: TimeRange.Month,
      },
      validate: jest.fn(),
    });

    mockForm.values.aiProvider = '1';

    render(<ModelInput form={mockForm} />);

    const modelInput = screen.getByLabelText('Model');

    await userEvent.click(modelInput);

    await waitFor(() => {
      expect(screen.queryByText('GPT 4o')).toBeInTheDocument();
      expect(screen.queryByText('GPT 3.5 Turbo')).toBeInTheDocument();
      expect(screen.queryByText('GPT 4 Turbo')).toBeInTheDocument();
    });
  });

  it('disables input if no models are available', async () => {
    (useGetModels as jest.Mock).mockReturnValue({ data: { models: [] } });

    render(<ModelInput form={mockForm} />);

    const modelInput = screen.getByLabelText('Model');

    expect(modelInput).toBeDisabled();
  });
});
