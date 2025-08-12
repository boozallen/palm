import { UseFormReturnType, useForm } from '@mantine/form';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AiProviderInput from './AiProviderInput';
import useGetAiProviders from '@/features/settings/api/get-ai-providers';
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

jest.mock('@/features/settings/api/get-ai-providers');

describe('AiProviderInput', () => {

  const mockForm: UseFormReturnType<AnalyticsQuery> = useForm<AnalyticsQuery>({
    initialValues: {
      initiatedBy: InitiatedBy.Any,
      aiProvider: 'all',
      model: 'all',
      timeRange: TimeRange.Month,
    },
    validate: jest.fn(),
  });

  const aiProviderResults = {
    aiProviders: [
      { id: '1', label: 'OpenAI', createdAt: new Date(), updatedAt: new Date() },
      { id: '2', label: 'Anthropic', createdAt: new Date(), updatedAt: new Date() },
      { id: '3', label: 'Azure OpenAI', createdAt: new Date(), updatedAt: new Date() },
    ],
  };

  beforeEach(() => {
    (useGetAiProviders as jest.Mock).mockReturnValue({ data: aiProviderResults });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders AiProviderInput', () => {
    render(<AiProviderInput form={mockForm}/>);

    const aiProviderInput = screen.queryByLabelText('AI Provider');
    expect(aiProviderInput).toBeInTheDocument();
    expect(aiProviderInput).toHaveAttribute('placeholder', 'Select AI provider');
  });

  it('displays AI providers', async () => {
    render(<AiProviderInput form={mockForm}/>);

    const aiProviderInput = screen.getByLabelText('AI Provider');

    await userEvent.click(aiProviderInput);

    await waitFor(() => {
      expect(screen.queryByText('OpenAI')).toBeInTheDocument();
      expect(screen.queryByText('Anthropic')).toBeInTheDocument();
      expect(screen.queryByText('Azure OpenAI')).toBeInTheDocument();
    });
  });

  it('disables input if no providers are available', async () => {
    (useGetAiProviders as jest.Mock).mockReturnValue({ data:  { aiProviders: [] } });

    render(<AiProviderInput form={mockForm}/>);

    const aiProviderInput = screen.getByLabelText('AI Provider');

    expect(aiProviderInput).toBeDisabled();
  });
});
