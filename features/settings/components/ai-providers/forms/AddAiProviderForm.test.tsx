import {
  AiProviderLabels,
  AiProviderType,
  AiProvidersSelectInputOptions,
} from '@/features/shared/types';
import AddAiProviderForm from './AddAiProviderForm';
import { render, fireEvent, act, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useAddAiProvider from '@/features/settings/api/ai-providers/add-ai-provider';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { TRPCError } from '@trpc/server';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/features/settings/api/ai-providers/add-ai-provider');
(useAddAiProvider as jest.Mock).mockReturnValue({
  mutateAsync: jest.fn(),
  isPending: false,
  error: null,
});

jest.mock('@mantine/notifications');

jest.mock('@/features/shared/api/get-feature-flag');

describe('AddAiProviderForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    const result = render(<AddAiProviderForm setFormCompleted={jest.fn()} />);

    expect(result).toBeTruthy();
  });

  it('renders correct select options for AI Provider type', async () => {
    const { getByLabelText } = render(<AddAiProviderForm setFormCompleted={jest.fn()} />);

    const selectElement = getByLabelText('AI Provider');
    await userEvent.click(selectElement);

    await waitFor(() => {
      AiProvidersSelectInputOptions.forEach((option) => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });
  });

  it('should have error message when Ai Provider is not selected', async () => {
    const { getByTestId, queryByText } = render(
      <AddAiProviderForm setFormCompleted={jest.fn()} />
    );
    const aiProviderError = 'An AI Provider is required';
    const submitButton = getByTestId('submit');

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(queryByText(aiProviderError)).toBeInTheDocument();
  });

  it('formats token cost values correctly', async () => {
    render(<AddAiProviderForm setFormCompleted={jest.fn()} />);
    const inputTokenCost = screen.getByLabelText(/Input Token Cost/);
    const outputTokenCost = screen.getByLabelText(/Output Token Cost/);

    fireEvent.change(inputTokenCost, { target: { value: '1000000.555' } });
    fireEvent.change(outputTokenCost, { target: { value: '100.554321' } });

    expect(inputTokenCost).toHaveValue('1,000,000.56');
    expect(outputTokenCost).toHaveValue('100.55');
  });

  it('should have an error message when Label input is missing', async () => {
    const { getByTestId, queryByText } = render(
      <AddAiProviderForm setFormCompleted={jest.fn()} />
    );
    const aiProviderError = 'A label is required';
    const submitButton = getByTestId('submit');

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(queryByText(aiProviderError)).toBeInTheDocument();
  });

  describe.each(AiProvidersSelectInputOptions)(
    'Test form behavior for %s',
    (aiProvider) => {
      it('renders correct form fields', async () => {
        const { getByTestId, queryByTestId, findByText, queryByLabelText } = render(
          <AddAiProviderForm setFormCompleted={jest.fn()} />
        );

        const selectElement = getByTestId('AI Provider');
        await userEvent.click(selectElement);

        const option = await findByText(aiProvider.label);
        await userEvent.click(option);

        expect(queryByTestId('Label')).toBeInTheDocument();
        expect(queryByLabelText(/Input Token Cost/)).toBeInTheDocument();
        expect(queryByLabelText(/Output Token Cost/)).toBeInTheDocument();
        await waitFor(() => {
          switch (aiProvider.value) {
            case AiProviderType.OpenAi.toString():
            case AiProviderType.Anthropic.toString():
            case AiProviderType.Gemini.toString():
              expect(queryByTestId('API Key')).toBeInTheDocument();
              expect(queryByTestId('API Endpoint')).not.toBeInTheDocument();
              break;
            case AiProviderType.AzureOpenAi.toString():
              expect(queryByTestId('API Key')).toBeInTheDocument();
              expect(queryByTestId('API Endpoint')).toBeInTheDocument();
              break;
            case AiProviderType.Bedrock.toString():
              expect(queryByLabelText('Access Key ID')).toBeInTheDocument();
              expect(queryByLabelText('Secret Access Key')).toBeInTheDocument();
              expect(queryByLabelText('Session Token')).toBeInTheDocument();
              expect(queryByLabelText('Region')).toBeInTheDocument();
              expect(queryByTestId('API Key')).not.toBeInTheDocument();
              expect(queryByTestId('API Endpoint')).not.toBeInTheDocument();
          }
        });
      });

      it('displays form field errors when fields are empty and form submits', async () => {
        const { getByTestId, queryByText, findByText } = render(
          <AddAiProviderForm setFormCompleted={jest.fn()} />
        );

        const submitButton = getByTestId('submit');
        const selectElement = getByTestId('AI Provider');
        await userEvent.click(selectElement);

        const option = await findByText(aiProvider.label);
        await userEvent.click(option);

        await act(async () => {
          fireEvent.click(submitButton);
        });

        const apiKeyError = 'An API key is required';
        const apiEndpointError = 'An API endpoint is required';

        switch (aiProvider.value) {
          case AiProviderType.OpenAi.toString():
          case AiProviderType.Anthropic.toString():
          case AiProviderType.Gemini.toString():
            expect(queryByText(apiKeyError)).toBeInTheDocument();
            break;
          case AiProviderType.AzureOpenAi.toString():
            expect(queryByText(apiKeyError)).toBeInTheDocument();
            expect(queryByText(apiEndpointError)).toBeInTheDocument();
            break;
        }
      });
    }
  );

  it('displays form field errors if token costs is gte $1,000', async () => {
    const { getByTestId, queryByText, getByLabelText } = render(
      <AddAiProviderForm setFormCompleted={jest.fn()} />
    );

    const submitButton = getByTestId('submit');
    const inputTokenCost = getByLabelText(/Input Token Cost/);
    const outputTokenCost = getByLabelText(/Output Token Cost/);

    fireEvent.change(inputTokenCost, { target: { value: '1001' } });
    fireEvent.change(outputTokenCost, { target: { value: '1001' } });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(queryByText('Input token cost should not exceed $1,000.00')).toBeInTheDocument();
      expect(queryByText('Output token cost should not exceed $1,000.00')).toBeInTheDocument();
    });
  });

  it('renders loading state when data is pending', () => {
    (useAddAiProvider as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: true,
      error: null,
    });

    const { getByTestId, getByText } = render(
      <AddAiProviderForm setFormCompleted={jest.fn()} />
    );

    const submitButton = getByTestId('submit');
    expect(submitButton).toContainElement(getByText('Adding AI Provider'));
  });

  it('displays an error notification when form submission fails', async () => {
    const errorMessage = 'Error creating AI provider configuration';
    const addAiProvider = jest.fn();
    (useAddAiProvider as jest.Mock).mockReturnValue({
      mutateAsync: addAiProvider.mockRejectedValue(new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        cause: expect.anything(),
        message: errorMessage,
      })),
      isPending: false,
      error: new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        cause: expect.anything(),
        message: errorMessage,
      }),
    });

    const { getByTestId, findByText } = render(
      <AddAiProviderForm setFormCompleted={jest.fn()} />
    );
    const submitButton = getByTestId('submit');

    // Select a provider
    const selectElement = getByTestId('AI Provider');
    await userEvent.click(selectElement);
    const option = await findByText(AiProviderLabels[AiProviderType.OpenAi]);
    await userEvent.click(option);

    const labelInput = getByTestId('Label');

    await userEvent.click(labelInput);
    await userEvent.type(labelInput, 'Test Label');
    const apiKey = getByTestId('API Key');
    fireEvent.change(apiKey, { target: { value: 'test' } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Add AI Provider Failed',
        message: errorMessage,
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    });
  });
});
