import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import AddUserGroupForm from './AddUserGroupForm';
import useCreateUserGroup from '@/features/settings/api/user-groups/create-user-group';
import { UserGroupForm } from '@/features/shared/types/user-group';

jest.mock('@/features/settings/api/user-groups/create-user-group');
jest.mock('@mantine/notifications');

describe('AddUserGroupForm', () => {
  const setFormCompleted = jest.fn();
  const createUserGroup = jest.fn();

  const newValues: UserGroupForm = {
    label: 'Test Label',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useCreateUserGroup as jest.Mock).mockReturnValue({
      mutateAsync: createUserGroup,
      isPending: false,
      error: null,
    });

    render(<AddUserGroupForm setFormCompleted={setFormCompleted} />);
  });

  it('should render correct form field', () => {
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
  });

  it('should display error message for empty field', async () => {

    expect(screen.queryByText('A label is required')).not.toBeInTheDocument();

    const submitButton = screen.getByText('Add Group');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('A label is required')).toBeInTheDocument();
      expect(createUserGroup).not.toHaveBeenCalled();
    });
  });

  it('should display error message for empty trimmed submissions', async () => {
    expect(screen.queryByText('A label is required')).not.toBeInTheDocument();

    const newValue = '      ';

    const labelInput = screen.getByLabelText('Label');
    fireEvent.change(labelInput, { target: { value: newValue } });

    const submitButton = screen.getByText('Add Group');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('A label is required')).toBeInTheDocument();
      expect(createUserGroup).not.toHaveBeenCalled();
    });
  });

  it('should set formCompleted to true when users click cancel', async () => {
    const cancelButton = screen.getByText('Cancel');

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(setFormCompleted).toHaveBeenCalledWith(true);
    expect(createUserGroup).not.toHaveBeenCalled();
  });

  it('should call api upon successful form submission', async () => {
    const submitButton = screen.getByText('Add Group');

    const labelInput = screen.getByLabelText('Label');
    fireEvent.change(labelInput, { target: { value: newValues.label } });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(createUserGroup).toHaveBeenCalledWith(newValues);
    expect(setFormCompleted).toHaveBeenCalledWith(true);
  });

  it('should display error notification when createUserGroup fails', async () => {
    createUserGroup.mockRejectedValue(new Error('Test Error'));

    const submitButton = screen.getByText('Add Group');

    const labelInput = screen.getByLabelText('Label');
    fireEvent.change(labelInput, { target: { value: newValues.label } });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(notifications.show).toHaveBeenCalledWith({
      id: 'create-user-group-error',
      title: 'Failed to Add User Group',
      message: 'Test Error',
      icon: <IconX />,
      autoClose: false,
      variant: 'failed_operation',
    });
    expect(setFormCompleted).not.toHaveBeenCalled();
  });
});
