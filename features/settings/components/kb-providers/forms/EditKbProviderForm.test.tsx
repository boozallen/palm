import { fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditKbProviderForm, { EditKbProviderFormProps } from './EditKbProviderForm';
import { KbProviderForm, KbProviderType, KbProvidersSelectInputOptions } from '@/features/shared/types';
import useUpdateKbProvider from '@/features/settings/api/kb-providers/update-kb-provider';
import { TRPCError } from '@trpc/server';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { passwordInputPlaceholder } from '@/features/shared/utils';

jest.mock('@/features/settings/api/kb-providers/update-kb-provider');
jest.mock('@mantine/notifications');

describe('EditKbProviderForm', () => {
  const kbProviderId = 'd991cc5c-4710-474e-ad8d-57e8627c4fa7';
  const setFormCompleted = jest.fn();
  const updateKbProvider = jest.fn();

  const initialValues: KbProviderForm = {
    label: 'Test KB Provider',
    kbProviderType: KbProviderType.KbProviderPalm,
    config: {
      apiKey: passwordInputPlaceholder,
      apiEndpoint: 'api.endpoint.com',
    },
  };

  const defaultProps: EditKbProviderFormProps = {
    kbProviderId,
    initialValues,
    setFormCompleted,
  };

  const setupMocks = (error: Error | null = null) => {
    jest.resetAllMocks();

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    (useUpdateKbProvider as jest.Mock).mockReturnValue({
      mutateAsync: updateKbProvider,
      isPending: false,
      error,
    });
  };

  const validationErrors = {
    label: 'A label is required',
    apiKey: 'An API key is required',
    apiEndpoint: 'An API endpoint is required',
    knowledgeBaseId: 'A knowledge base ID is required',
  };

  const renderComponent = (props = defaultProps) => render(<EditKbProviderForm {...props} />);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('KB provider form functionality verification', () => {
    beforeEach(() => {
      setupMocks();
    });

    it('renders without crashing', () => {
      const { container } = renderComponent();
      expect(container).toBeTruthy();
    });

    it('disables submit button if form is not dirty and prevents submission', async () => {
      const { getByRole } = renderComponent();
      expect(getByRole('button', { name: 'Save Changes' })).toBeDisabled();
      expect(setFormCompleted).not.toBeCalled();
      expect(updateKbProvider).not.toBeCalled();
    });

    it('sets form completed to true on cancel', async () => {
      const { getByRole } = renderComponent();
      await userEvent.click(getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(setFormCompleted).toHaveBeenCalledWith(true);
        expect(updateKbProvider).not.toHaveBeenCalled();
      });
    });

    it('shows validation errors when fields are emptied for PALM provider', async () => {
      const kbProviderConfig = { apiKey: 'asd', apiEndpoint: '' };

      const providerInitialValues: KbProviderForm = {
        kbProviderType: Number(KbProviderType.KbProviderPalm),
        label: '',
        config: kbProviderConfig,
      };

      const providerProps: EditKbProviderFormProps = {
        kbProviderId,
        initialValues: providerInitialValues,
        setFormCompleted,
      };

      const { getByLabelText, getByRole, getByText } = renderComponent(providerProps);

      await userEvent.click(getByText('Replace'));
      fireEvent.change(getByLabelText('API Key'), { target: { value: '' } });

      await userEvent.click(getByRole('button', { name: 'Save Changes' }));

      expect(getByText(validationErrors.label)).toBeInTheDocument();
      expect(getByText(validationErrors.apiKey)).toBeInTheDocument();
      expect(getByText(validationErrors.apiEndpoint)).toBeInTheDocument();
    });
  });

  describe.each(KbProvidersSelectInputOptions)('Provider-specific rendering of form fields %p', (provider) => {
    const kbProviderConfig = Number(provider.value) === KbProviderType.KbProviderBedrock ? {
      accessKeyId: passwordInputPlaceholder,
      secretAccessKey: passwordInputPlaceholder,
      sessionToken: passwordInputPlaceholder,
      region: '',
    } : {
      apiKey: passwordInputPlaceholder,
      apiEndpoint: '',
    };

    const providerInitialValues: KbProviderForm = {
      kbProviderType: Number(provider.value),
      label: '',
      config: kbProviderConfig,
    };

    const providerProps: EditKbProviderFormProps = {
      kbProviderId,
      initialValues: providerInitialValues,
      setFormCompleted,
    };

    beforeEach(() => {
      setupMocks();
    });

    it('renders correct form fields', async () => {
      const { getByLabelText } = renderComponent(providerProps);
      expect(getByLabelText('Label')).toBeInTheDocument();
      switch (Number(provider.value)) {
        case KbProviderType.KbProviderPalm:
          expect(getByLabelText('API Endpoint')).toBeInTheDocument();
          expect(getByLabelText('API Key')).toBeInTheDocument();
          break;
        case KbProviderType.KbProviderBedrock:
          expect(getByLabelText('Access Key Id')).toBeInTheDocument();
          expect(getByLabelText('Secret Access Key')).toBeInTheDocument();
          expect(getByLabelText('Session Token')).toBeInTheDocument();
          expect(getByLabelText('Region')).toBeInTheDocument();
          break;
      }
    });

    it('calls submit handler when submit button is clicked', async () => {
      const { getByLabelText, getByRole } = renderComponent(providerProps);
      const formSubmissionValues = {
        id: kbProviderId,
        label: 'New KB Provider',
        kbProviderType: Number(provider.value),
        config: {},
      };

      const newLabel = 'New KB Provider';
      const newApiEndpoint = 'new.api.endpoint.com';

      fireEvent.change(getByLabelText('Label'), { target: { value: newLabel } });
      formSubmissionValues.label = newLabel;

      switch (Number(provider.value)) {
        case KbProviderType.KbProviderPalm:
          formSubmissionValues.config = { apiEndpoint: newApiEndpoint, apiKey: '' };
          fireEvent.change(getByLabelText('API Endpoint'), { target: { value: newApiEndpoint } });
          await userEvent.click(getByRole('button', { name: 'Save Changes' }));
          await waitFor(() => {
            expect(setFormCompleted).toBeCalled();
            expect(updateKbProvider).toBeCalledWith(formSubmissionValues);
          });
          break;
      }
    });
  });

  describe('Error Handling', () => {
    const error = new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'We are unable to process your request at this time',
    });

    beforeEach(() => {
      setupMocks(error);
    });

    it('displays notification toast upon error', async () => {
      const { getByLabelText, getByRole } = renderComponent();
      updateKbProvider.mockRejectedValue(error);

      const formSubmissionValues = {
        id: kbProviderId,
        label: 'New KB Provider',
        kbProviderType: KbProviderType.KbProviderPalm,
        config: { apiEndpoint: 'new.api.endpoint.com', apiKey: '' },
      };

      fireEvent.change(getByLabelText('API Endpoint'), { target: { value: 'new.api.endpoint.com' } });
      fireEvent.change(getByLabelText('Label'), { target: { value: 'New KB Provider' } });

      await userEvent.click(getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(updateKbProvider).toBeCalledWith(formSubmissionValues);
        expect(setFormCompleted).not.toBeCalled();
        expect(notifications.show).toHaveBeenCalledWith({
          id: 'update-kb-provider-failure',
          title: 'Failed to Update Knowledge Base Provider',
          message: error.message,
          icon: <IconX />,
          variant: 'failed_operation',
        });
      });
    });
  });
});
