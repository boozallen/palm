import { act, fireEvent, render, waitFor } from '@testing-library/react';
import EditTermsOfUseForm from '@/features/settings/components/system-configurations/forms/EditTermsOfUseForm';
import { useUpdateSystemConfig } from '@/features/settings/api/update-system-config';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

jest.mock('@/features/settings/api/update-system-config');
jest.mock('@mantine/notifications');

describe('EditTermsOfUseForm', () => {
  const termsOfUseHeader = 'Header';
  const termsOfUseBody = 'Body';
  const termsOfUseCheckboxLabel = 'Checkbox label';

  const updateSystemConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutate: updateSystemConfig,
      isPending: false,
      error: null,
    });
  });

  it('should render without crashing', () => {
    const { container } = render(<EditTermsOfUseForm termsOfUseHeader={termsOfUseHeader} termsOfUseBody={termsOfUseBody} termsOfUseCheckboxLabel={termsOfUseCheckboxLabel} />);
    expect(container).toBeTruthy();
  });

  it('should disable button when user inputs nothing', () => {
    const { getByTestId } = render(<EditTermsOfUseForm termsOfUseHeader={termsOfUseHeader} termsOfUseBody={termsOfUseBody} termsOfUseCheckboxLabel={termsOfUseCheckboxLabel} />);
    expect(getByTestId('submit')).toBeDisabled();
  });

  it('should enabled button when user changes header value.', () => {
    const { getByTestId } = render(<EditTermsOfUseForm termsOfUseHeader={termsOfUseHeader} termsOfUseBody={termsOfUseBody} termsOfUseCheckboxLabel={termsOfUseCheckboxLabel} />);
    expect(getByTestId('submit')).toBeDisabled();

    const textAreaHeader = getByTestId('terms-of-use-header-textarea');
    fireEvent.change(textAreaHeader, { target: { value: 'Hello World' } });

    expect(getByTestId('submit')).toBeEnabled();
  });

  it('should display correct zod validation when fields are empty upon submission', async () => {
    const { getByTestId, queryByText } = render(<EditTermsOfUseForm termsOfUseHeader={termsOfUseHeader} termsOfUseBody={termsOfUseBody} termsOfUseCheckboxLabel={termsOfUseCheckboxLabel} />);
    const headerErrorMessage = 'Header cannot be empty';
    const bodyErrorMessage = 'Body cannot be empty';
    const checkboxLabelErrorMessage = 'Checkbox label cannot be empty';

    const textAreaHeader = getByTestId('terms-of-use-header-textarea');
    fireEvent.change(textAreaHeader, { target: { value: '' } });
    const textAreaBody = getByTestId('terms-of-use-body-textarea');
    fireEvent.change(textAreaBody, { target: { value: '' } });
    const textAreaCheckboxLabel = getByTestId('terms-of-use-checkbox-label-textarea');
    fireEvent.change(textAreaCheckboxLabel, { target: { value: '' } });

    const submitButton = getByTestId('submit');
    expect(getByTestId('submit')).toBeEnabled();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(queryByText(bodyErrorMessage)).toBeInTheDocument();
      expect(queryByText(headerErrorMessage)).toBeInTheDocument();
      expect(queryByText(checkboxLabelErrorMessage)).toBeInTheDocument();
    });
  });

  it('should update fields when there are new values and update button is clicked', async () => {
    const { getByTestId } = render(<EditTermsOfUseForm termsOfUseHeader={termsOfUseHeader} termsOfUseBody={termsOfUseBody} termsOfUseCheckboxLabel={termsOfUseCheckboxLabel} />);

    const textAreaHeader = getByTestId('terms-of-use-header-textarea');
    fireEvent.change(textAreaHeader, { target: { value: 'header' } });
    const textAreaBody = getByTestId('terms-of-use-body-textarea');
    fireEvent.change(textAreaBody, { target: { value: 'body' } });
    const textAreaCheckboxLabel = getByTestId('terms-of-use-checkbox-label-textarea');
    fireEvent.change(textAreaCheckboxLabel, { target: { value: 'checkbox label' } });

    expect(textAreaHeader).toHaveValue('header');

    const submitButton = getByTestId('submit');
    expect(submitButton).toBeEnabled();

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(updateSystemConfig).toHaveBeenCalled();
  });

  it('should display error notification when update fails', async () => {
    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutate: updateSystemConfig.mockImplementation(() => {
        throw new Error('Failed to update');
      }),
      isPending: false,
      error: new Error('Failed to update'),
    });
    const { getByTestId } = render(<EditTermsOfUseForm termsOfUseHeader={termsOfUseHeader} termsOfUseBody={termsOfUseBody} termsOfUseCheckboxLabel={termsOfUseCheckboxLabel} />);

    const textAreaHeader = getByTestId('terms-of-use-header-textarea');
    fireEvent.change(textAreaHeader, { target: { value: 'header' } });
    const textAreaBody = getByTestId('terms-of-use-body-textarea');
    fireEvent.change(textAreaBody, { target: { value: 'body' } });
    const textAreaCheckboxLabel = getByTestId('terms-of-use-checkbox-label-textarea');
    fireEvent.change(textAreaCheckboxLabel, { target: { value: 'checkbox label' } });

    expect(textAreaHeader).toHaveValue('header');

    const submitButton = getByTestId('submit');
    expect(submitButton).toBeEnabled();

    await act(async () => {
      fireEvent.submit(submitButton);
    });

    await waitFor(() => {
      expect(updateSystemConfig).toHaveBeenCalled();
      expect(notifications.show).toHaveBeenCalledWith(
        {
          title: 'Update System Configuration Failed',
          message: 'Failed to update',
          icon: <IconX />,
          autoClose: false,
          withCloseButton: true,
          variant: 'failed_operation',
        }
      );
    });
  });
});
