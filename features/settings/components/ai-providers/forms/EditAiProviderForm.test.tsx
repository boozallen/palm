import { fireEvent, render, waitFor } from '@testing-library/react';
import EditAiProviderForm, {
  EditAiProviderFormProps,
  EditAiProviderFormValues,
} from './EditAiProviderForm';
import { AiProviderType, AiProvidersSelectInputOptions } from '@/features/shared/types';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { passwordInputPlaceholder } from '@/features/shared/utils';
import { useEditAiProviderForm } from '@/features/settings/hooks/useEditAiProviderForm';
import { useEditAiProviderConfig } from '@/features/settings/hooks/useEditAiProviderConfig';
import { EditAiProviderConfig } from '@/features/settings/components/ai-providers/forms/EditAiProviderConfig';

jest.mock('@/features/settings/components/ai-providers/forms/EditAiProviderConfig', () => ({
  EditAiProviderConfig: jest.fn(() => <div data-testid='mock-edit-ai-provider-config' />),
}));

jest.mock('@/features/settings/hooks/useEditAiProviderForm');
jest.mock('@/features/settings/hooks/useEditAiProviderConfig');
jest.mock('@mantine/notifications');

describe('EditAiProviderForm', () => {
  const aiProviderId = 'd991cc5c-4710-474e-ad8d-57e8627c4fa7';
  const setFormCompleted = jest.fn();
  const handleSubmitMock = jest.fn();
  const handleReplaceMock = jest.fn();

  const createFormMock = (initialValues: any, errors: Record<string, string> = {}) => ({
    values: { ...initialValues },
    errors: errors,
    isDirty: jest.fn().mockReturnValue(true),
    validate: jest.fn(),
    getInputProps: jest.fn((fieldName) => ({
      name: fieldName,
      value: initialValues[fieldName] || '',
      onChange: jest.fn((e) => {
        if (e?.target?.value !== undefined) {
          initialValues[fieldName] = e.target.value;
        }
      }),
      error: errors[fieldName],
    })),
    setFieldValue: jest.fn((field, value) => {
      initialValues[field] = value;
    }),
    onSubmit: jest.fn(callback => (e: { preventDefault: () => void; }) => {
      e?.preventDefault?.();
      return callback(initialValues);
    }),
    reset: jest.fn(),
  });

  const mockConfigProps = {
    displayInputApiEndpoint: false,
    displayInputApiKey: true,
    displayAwsFields: false,
    replaceApiKey: false,
    replaceAwsFields: {
      accessKeyId: false,
      secretAccessKey: false,
      sessionToken: false,
    },
    handleReplace: handleReplaceMock,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    handleSubmitMock.mockResolvedValue({ success: true });

    (useEditAiProviderForm as jest.Mock).mockImplementation((_, values) => {
      return {
        form: createFormMock(values),
        handleSubmit: handleSubmitMock,
        updateAiProviderIsLoading: false,
      };
    });

    (useEditAiProviderConfig as jest.Mock).mockReturnValue(mockConfigProps);

    (EditAiProviderConfig as jest.Mock).mockImplementation(() =>
      <div data-testid='mock-edit-ai-provider-config' />
    );
  });

  describe('Edit AI provider form functionality', () => {
    const initialValues: EditAiProviderFormValues = {
      label: 'Test Edit AI Provider',
      aiProvider: AiProviderType.AzureOpenAi.toString(),
      secretAccessKey: passwordInputPlaceholder,
      accessKeyId: passwordInputPlaceholder,
      sessionToken: passwordInputPlaceholder,
      apiKey: passwordInputPlaceholder,
      apiEndpoint: 'chat.openai.com',
      region: '',
      inputCostPerMillionTokens: 42.00,
      outputCostPerMillionTokens: 50.50,
    };

    const props: EditAiProviderFormProps = {
      aiProviderId,
      initialValues,
      setFormCompleted,
    };

    it('renders without crashing', () => {
      const { container } = render(<EditAiProviderForm {...props} />);
      expect(container).toBeTruthy();
    });

    it('has select input disabled', () => {
      const { getByTestId } = render(<EditAiProviderForm {...props} />);
      expect(getByTestId('select-ai-provider')).toBeDisabled();
    });

    it('renders the EditAiProviderConfig component with correct props', () => {
      render(<EditAiProviderForm {...props} />);

      expect(EditAiProviderConfig).toHaveBeenCalled();

      const calledProps = (EditAiProviderConfig as jest.Mock).mock.calls[0][0];

      expect(calledProps).toHaveProperty('form');

      Object.keys(mockConfigProps).forEach(key => {
        expect(calledProps).toHaveProperty(key);
      });
    });

    it('disables submit button if form is not dirty and prevents submission', async () => {
      (useEditAiProviderForm as jest.Mock).mockImplementation((_, values) => {
        return {
          form: {
            ...createFormMock(values),
            isDirty: jest.fn().mockReturnValue(false),
          },
          handleSubmit: handleSubmitMock,
          updateAiProviderIsLoading: false,
        };
      });

      const { getByTestId } = render(<EditAiProviderForm {...props} />);

      const submitButton = getByTestId('submit');
      fireEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
      expect(setFormCompleted).not.toHaveBeenCalled();
      expect(handleSubmitMock).not.toHaveBeenCalled();
    });

    it('sets form completed to true on cancel', async () => {
      const { getByTestId } = render(<EditAiProviderForm {...props} />);

      const cancelButton = getByTestId('cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(setFormCompleted).toHaveBeenCalledWith(true);
        expect(handleSubmitMock).not.toHaveBeenCalled();
      });
    });

    it('passes handleReplace function to the config component', async () => {
      render(<EditAiProviderForm {...props} />);

      const calledProps = (EditAiProviderConfig as jest.Mock).mock.calls[0][0];

      expect(calledProps.handleReplace).toBe(handleReplaceMock);
    });

    it('handles form submission success', async () => {
      handleSubmitMock.mockResolvedValueOnce({ success: true });

      const { getByTestId } = render(<EditAiProviderForm {...props} />);

      const formMock = (useEditAiProviderForm as jest.Mock).mock.results[0].value.form;
      formMock.isDirty.mockReturnValue(true);

      fireEvent.submit(getByTestId('submit'));

      await waitFor(() => {
        expect(handleSubmitMock).toHaveBeenCalled();
        expect(notifications.show).not.toHaveBeenCalled();
      });
    });

    it('handles form submission errors', async () => {
      const error = new Error('Test error');
      handleSubmitMock.mockResolvedValueOnce({ success: false, error });

      const { getByTestId } = render(<EditAiProviderForm {...props} />);

      fireEvent.submit(getByTestId('submit'));

      await waitFor(() => {
        expect(handleSubmitMock).toHaveBeenCalled();
        expect(notifications.show).toHaveBeenCalledWith({
          id: 'update-ai-provider-failure',
          title: 'Failed to Update AI Provider',
          message: error.message,
          icon: <IconX />,
          variant: 'failed_operation',
        });
      });
    });
  });

  describe.each(AiProvidersSelectInputOptions)('Provider-specific configuration for %p', (provider) => {
    const initialValues: EditAiProviderFormValues = {
      aiProvider: provider.value,
      label: '',
      apiKey: passwordInputPlaceholder,
      accessKeyId: passwordInputPlaceholder,
      secretAccessKey: passwordInputPlaceholder,
      sessionToken: passwordInputPlaceholder,
      apiEndpoint: '',
      region: '',
      inputCostPerMillionTokens: -24.00,
      outputCostPerMillionTokens: -50.50,
    };

    const props: EditAiProviderFormProps = {
      aiProviderId,
      initialValues,
      setFormCompleted,
    };

    it('passes correct configuration to EditAiProviderConfig', () => {
      const providerType = Number(provider.value);
      const isApiEndpoint = [
        AiProviderType.AzureOpenAi,
      ].includes(providerType);

      const isApiKey = [
        AiProviderType.OpenAi,
        AiProviderType.AzureOpenAi,
        AiProviderType.Anthropic,
        AiProviderType.Gemini,
      ].includes(providerType);

      const isAws = providerType === AiProviderType.Bedrock;

      const configProps = {
        displayInputApiEndpoint: isApiEndpoint,
        displayInputApiKey: isApiKey,
        displayAwsFields: isAws,
        replaceApiKey: false,
        replaceAwsFields: {
          accessKeyId: false,
          secretAccessKey: false,
          sessionToken: false,
        },
        handleReplace: handleReplaceMock,
      };

      (useEditAiProviderConfig as jest.Mock).mockReturnValue(configProps);

      render(<EditAiProviderForm {...props} />);

      expect(useEditAiProviderConfig).toHaveBeenCalledWith(
        expect.anything(),
        providerType
      );
    });
  });

  describe('Error Handling', () => {
    const error = new Error('We are unable to process your request at this time');

    const initialValues: EditAiProviderFormValues = {
      aiProvider: AiProviderType.AzureOpenAi.toString(),
      label: 'Test AI Provider',
      apiKey: passwordInputPlaceholder,
      accessKeyId: passwordInputPlaceholder,
      secretAccessKey: passwordInputPlaceholder,
      sessionToken: passwordInputPlaceholder,
      apiEndpoint: 'chat.openai.com',
      region: '',
    };

    const props: EditAiProviderFormProps = {
      aiProviderId,
      initialValues,
      setFormCompleted,
    };

    it('displays notification toast upon error', async () => {
      handleSubmitMock.mockResolvedValueOnce({ success: false, error });

      const { getByTestId } = render(<EditAiProviderForm {...props} />);

      const submitButton = getByTestId('submit');
      fireEvent.submit(submitButton);

      await waitFor(() => {
        expect(handleSubmitMock).toHaveBeenCalled();
        expect(setFormCompleted).not.toHaveBeenCalled();
        expect(notifications.show).toHaveBeenCalledWith({
          id: 'update-ai-provider-failure',
          title: 'Failed to Update AI Provider',
          message: error.message,
          icon: <IconX />,
          variant: 'failed_operation',
        });
      });
    });
  });

  describe('Loading State', () => {
    const initialValues: EditAiProviderFormValues = {
      aiProvider: AiProviderType.OpenAi.toString(),
      label: 'Test AI Provider',
      apiKey: passwordInputPlaceholder,
      accessKeyId: passwordInputPlaceholder,
      secretAccessKey: passwordInputPlaceholder,
      sessionToken: passwordInputPlaceholder,
      apiEndpoint: '',
      region: '',
    };

    const props: EditAiProviderFormProps = {
      aiProviderId,
      initialValues,
      setFormCompleted,
    };

    it('shows loading state during submission', () => {
      (useEditAiProviderForm as jest.Mock).mockImplementation((_, values) => {
        return {
          form: createFormMock(values),
          handleSubmit: handleSubmitMock,
          updateAiProviderIsLoading: true,
        };
      });

      const { getByTestId } = render(<EditAiProviderForm {...props} />);

      expect(getByTestId('submit')).toHaveAttribute('data-loading');
      expect(getByTestId('submit').textContent).toBe('Saving Changes');
    });
  });
});
