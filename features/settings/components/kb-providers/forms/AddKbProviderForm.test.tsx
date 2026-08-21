import userEvent from '@testing-library/user-event';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { TRPCError } from '@trpc/server';

import AddKbProviderForm from './AddKbProviderForm';
import {
  KbProviderLabels,
  KbProvidersSelectInputOptions,
  KbProviderType,
} from '@/features/shared/types';
import useAddKbProvider from '@/features/settings/api/kb-providers/add-kb-provider';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { features } from '@/libs/featureFlags';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/kb-providers/add-kb-provider');
jest.mock('@/features/shared/api/get-feature-flag');

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const validateProviderError = 'A KB Provider is required';
const validateLabelError = 'A label is required';
const validateApiKeyError = 'An API key is required';
const validateApiEndpointError = 'An API endpoint is required';

describe('AddKbProviderForm', () => {
  const addAiProvider = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useAddKbProvider as jest.Mock).mockReturnValue({
      mutateAsync: addAiProvider,
      isPending: false,
      error: null,
    });

    (useGetFeatureFlag as jest.Mock).mockImplementation(() => ({
      data: { isFeatureOn: true },
    }));
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(<AddKbProviderForm setFormCompleted={jest.fn()} />);
    expect(getByTestId('add-kb-provider-form')).toBeInTheDocument();
  });

  it('filters out PALM KB provider based on feature flags', async () => {
    (useGetFeatureFlag as jest.Mock).mockImplementation(({ feature }) => {
      if (feature === features.PALM_KB) {
        return { data: { isFeatureOn: false } };
      }
      return { data: { isFeatureOn: false } };
    });

    const { getByLabelText, queryByText } = render(<AddKbProviderForm setFormCompleted={jest.fn()} />);
    await userEvent.click(getByLabelText('Knowledge Base Provider'));

    expect(queryByText('PALM')).not.toBeInTheDocument();
  });

  it.each(KbProvidersSelectInputOptions)('renders correct input fields for %s', async (provider) => {
    const { getByLabelText, findByText } = render(
      <AddKbProviderForm setFormCompleted={jest.fn()} />
    );

    const input = getByLabelText('Knowledge Base Provider');
    await userEvent.click(input);

    const option = await findByText(provider.label);
    await userEvent.click(option);

    switch (provider.value) {
      case KbProviderType.KbProviderPalm.toString():
        expect(getByLabelText('API Endpoint')).toBeInTheDocument();
        expect(getByLabelText('API Key')).toBeInTheDocument();
        break;
      case KbProviderType.KbProviderBedrock.toString(): {
        expect(getByLabelText('Access Key Id')).toBeInTheDocument();
        expect(getByLabelText('Secret Access Key')).toBeInTheDocument();
        expect(getByLabelText('Session Token')).toBeInTheDocument();
        expect(getByLabelText('Region')).toBeInTheDocument();
        break;
      }
      default:
        throw new Error(`Unknown provider type: ${provider.value}`);
    }
  });

  it('shows validation errors when a provider is not selected', async () => {
    const { getByLabelText, getByRole, getByText } = render(
      <AddKbProviderForm setFormCompleted={jest.fn()} />
    );

    await userEvent.click(getByLabelText('Knowledge Base Provider'));
    await userEvent.click(getByRole('button', { name: 'Add' }));

    expect(getByText(validateProviderError)).toBeInTheDocument();
    expect(getByText(validateLabelError)).toBeInTheDocument();
  });

  it('shows validation errors when fields are empty for PALM provider', async () => {
    const { getByLabelText, getByRole, getByText, findByText } = render(
      <AddKbProviderForm setFormCompleted={jest.fn()} />
    );
    await userEvent.click(getByLabelText('Knowledge Base Provider'));

    const option = await findByText(KbProviderLabels[KbProviderType.KbProviderPalm]);
    await userEvent.click(option);

    await userEvent.click(getByRole('button', { name: 'Add' }));

    expect(getByText(validateLabelError)).toBeInTheDocument();
    expect(getByText(validateApiKeyError)).toBeInTheDocument();
    expect(getByText(validateApiEndpointError)).toBeInTheDocument();
  });

  it('renders loading state when data is pending', () => {
    (useAddKbProvider as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: true,
      error: null,
    });

    const { getByRole } = render(<AddKbProviderForm setFormCompleted={jest.fn()} />);
    const submitButton = getByRole('button', { name: 'Adding' });
    expect(submitButton).toBeInTheDocument();
  });

  it('handles form submission errors', async () => {
    const errorMessage = 'Error creating KB provider configuration';
    (useAddKbProvider as jest.Mock).mockReturnValue({
      mutateAsync: addAiProvider.mockRejectedValue(new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
      })),
      isPending: false,
      error: new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
      }),
    });

    const { getByLabelText, getByRole, findByText } = render(<AddKbProviderForm setFormCompleted={jest.fn()} />);
    await userEvent.click(getByLabelText('Knowledge Base Provider'));

    const option = await findByText(KbProviderLabels[KbProviderType.KbProviderPalm]);
    await userEvent.click(option);

    fireEvent.change(getByLabelText('Label'), { target: { value: 'Test Label' } });
    fireEvent.change(getByLabelText('API Key'), { target: { value: 'Test API Key' } });
    fireEvent.change(getByLabelText('API Endpoint'), { target: { value: 'Test API Endpoint' } });

    await userEvent.click(getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'add-kb-provider-error',
        title: 'Failed to Add Knowledge Base Provider',
        message: errorMessage,
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    });
  });
});
