import { fireEvent, render, waitFor } from '@testing-library/react';
import EditLegalPolicyForm from '@/features/settings/components/system-configurations/forms/EditLegalPolicyForm';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { act } from 'react';

jest.mock('@/features/settings/api/system-configurations/update-system-config');
jest.mock('@mantine/notifications');

describe('EditLegalPolicyForm', () => {
  const legalPolicyHeader = 'Header';
  const legalPolicyBody = 'Body';

  const updateSystemConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutateAsync: updateSystemConfig,
      isPending: false,
      error: null,
    });
  });

  it('should render without crashing', () => {
    const { container } = render(<EditLegalPolicyForm legalPolicyHeader={legalPolicyHeader} legalPolicyBody={legalPolicyBody} />);
    expect(container).toBeTruthy();
  });

  it('should disable button when input is not dirty', () => {
    const { getByTestId } = render(<EditLegalPolicyForm legalPolicyHeader={legalPolicyHeader} legalPolicyBody={legalPolicyBody} />);
    expect(getByTestId('legal-policy-submit-button')).toBeDisabled();
  });

  it('should enable button when user changes header value.', () => {
    const { getByTestId } = render(<EditLegalPolicyForm legalPolicyHeader={legalPolicyHeader} legalPolicyBody={legalPolicyBody} />);
    expect(getByTestId('legal-policy-submit-button')).toBeDisabled();

    const textAreaHeader = getByTestId('legal-policy-header-textarea');
    fireEvent.change(textAreaHeader, { target: { value: 'Hello World' } });

    expect(getByTestId('legal-policy-submit-button')).toBeEnabled();
  });

  it('should display correct zod validation when fields are empty upon submission', async () => {
    const { getByTestId, queryByText } = render(<EditLegalPolicyForm legalPolicyHeader={legalPolicyHeader} legalPolicyBody={legalPolicyBody} />);
    const headerErrorMessage = 'Header cannot be empty';
    const bodyErrorMessage = 'Body cannot be empty';

    const textAreaHeader = getByTestId('legal-policy-header-textarea');
    fireEvent.change(textAreaHeader, { target: { value: '' } });
    const textAreaBody = getByTestId('legal-policy-body-textarea');
    fireEvent.change(textAreaBody, { target: { value: '' } });

    const submitButton = getByTestId('legal-policy-submit-button');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(queryByText(headerErrorMessage)).toBeInTheDocument();
      expect(queryByText(bodyErrorMessage)).toBeInTheDocument();
    });
  });

  it('should update system config when form is submitted', async () => {
    const { getByTestId } = render(<EditLegalPolicyForm legalPolicyHeader={legalPolicyHeader} legalPolicyBody={legalPolicyBody} />);
    const textAreaHeader = getByTestId('legal-policy-header-textarea');
    const textAreaBody = getByTestId('legal-policy-body-textarea');

    fireEvent.change(textAreaHeader, { target: { value: 'New header' } });
    fireEvent.change(textAreaBody, { target: { value: 'New body' } });

    const submitButton = getByTestId('legal-policy-submit-button');

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(updateSystemConfig).toHaveBeenCalled();
  });

  it('should show error notification when system config update fails', async () => {
    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutate: updateSystemConfig.mockImplementation(() => {
        throw new Error('Failed to update');
      }),
      isPending: false,
      error: new Error('Failed to update'),
    });

    const { getByTestId } = render(<EditLegalPolicyForm legalPolicyHeader={legalPolicyHeader} legalPolicyBody={legalPolicyBody} />);
    const textAreaHeader = getByTestId('legal-policy-header-textarea');
    const textAreaBody = getByTestId('legal-policy-body-textarea');

    fireEvent.change(textAreaHeader, { target: { value: 'New header' } });
    fireEvent.change(textAreaBody, { target: { value: 'New body' } });

    const submitButton = getByTestId('legal-policy-submit-button');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Update System Configuration Failed',
        message: 'Failed to update',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    });
  });

});
