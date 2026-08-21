import { fireEvent, render, waitFor } from '@testing-library/react';
import EditJoinUserGroupDialogForm from '@/features/settings/components/system-configurations/forms/EditJoinUserGroupDialogForm';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import { SystemConfigFields } from '@/features/shared/types';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { act } from 'react';

jest.mock('@/features/settings/api/system-configurations/update-system-config');
jest.mock('@mantine/notifications');

describe('EditJoinUserGroupDialogForm', () => {
  const joinUserGroupDialogExternalLink = 'https://example.com/get-access';

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
    const { container } = render(
      <EditJoinUserGroupDialogForm joinUserGroupDialogExternalLink={joinUserGroupDialogExternalLink} />
    );
    expect(container).toBeTruthy();
  });

  it('should disable button when input is not dirty', () => {
    const { getByTestId } = render(
      <EditJoinUserGroupDialogForm joinUserGroupDialogExternalLink={joinUserGroupDialogExternalLink} />
    );
    expect(getByTestId('join-user-group-dialog-submit-button')).toBeDisabled();
  });

  it('should enable button when user changes the link value', () => {
    const { getByTestId } = render(
      <EditJoinUserGroupDialogForm joinUserGroupDialogExternalLink={joinUserGroupDialogExternalLink} />
    );

    fireEvent.change(getByTestId('join-user-group-dialog-external-link-input'), {
      target: { value: 'https://example.com/other' },
    });

    expect(getByTestId('join-user-group-dialog-submit-button')).toBeEnabled();
  });

  it('should display validation error when the link is not a valid URL', async () => {
    const { getByTestId, queryByText } = render(
      <EditJoinUserGroupDialogForm joinUserGroupDialogExternalLink={joinUserGroupDialogExternalLink} />
    );

    fireEvent.change(getByTestId('join-user-group-dialog-external-link-input'), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(getByTestId('join-user-group-dialog-submit-button'));

    await waitFor(() => {
      expect(queryByText('Must be a valid URL')).toBeInTheDocument();
    });
    expect(updateSystemConfig).not.toHaveBeenCalled();
  });

  it('should allow an empty link to clear the configuration', async () => {
    const { getByTestId } = render(
      <EditJoinUserGroupDialogForm joinUserGroupDialogExternalLink={joinUserGroupDialogExternalLink} />
    );

    fireEvent.change(getByTestId('join-user-group-dialog-external-link-input'), {
      target: { value: '' },
    });

    await act(async () => {
      fireEvent.click(getByTestId('join-user-group-dialog-submit-button'));
    });

    expect(updateSystemConfig).toHaveBeenCalledWith({
      configField: SystemConfigFields.JoinUserGroupDialogExternalLink,
      configValue: '',
    });
  });

  it('should update system config when form is submitted', async () => {
    const { getByTestId } = render(
      <EditJoinUserGroupDialogForm joinUserGroupDialogExternalLink={joinUserGroupDialogExternalLink} />
    );

    fireEvent.change(getByTestId('join-user-group-dialog-external-link-input'), {
      target: { value: 'https://example.com/new-access' },
    });

    await act(async () => {
      fireEvent.click(getByTestId('join-user-group-dialog-submit-button'));
    });

    expect(updateSystemConfig).toHaveBeenCalledWith({
      configField: SystemConfigFields.JoinUserGroupDialogExternalLink,
      configValue: 'https://example.com/new-access',
    });
  });

  it('should show error notification when system config update fails', async () => {
    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutateAsync: updateSystemConfig.mockRejectedValue(new Error('Failed to update')),
      isPending: false,
      error: new Error('Failed to update'),
    });

    const { getByTestId } = render(
      <EditJoinUserGroupDialogForm joinUserGroupDialogExternalLink={joinUserGroupDialogExternalLink} />
    );

    fireEvent.change(getByTestId('join-user-group-dialog-external-link-input'), {
      target: { value: 'https://example.com/new-access' },
    });

    await act(async () => {
      fireEvent.click(getByTestId('join-user-group-dialog-submit-button'));
    });

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
