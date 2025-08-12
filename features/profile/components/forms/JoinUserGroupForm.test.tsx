import {
  fireEvent,
  render,
  screen,
  act,
  waitFor,
} from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import JoinUserGroupForm from './JoinUserGroupForm';
import useJoinUserGroupViaJoinCode from '@/features/profile/api/join-user-group-via-join-code';

jest.mock('@mantine/notifications');
jest.mock('@/features/profile/api/join-user-group-via-join-code');

const fillAndSubmitForm = async () => {
  const input = screen.getByLabelText('User Group Join Code');
  const button = screen.getByRole('button', { name: /Join User Group/i });

  fireEvent.change(input, { target: { value: '12345678' } });
  await act(async () => fireEvent.click(button));
};

describe('JoinUserGroupForm', () => {
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useJoinUserGroupViaJoinCode as jest.Mock).mockReturnValue({
      mutateAsync,
      error: null,
    });
  });

  it('renders a text input', () => {
    render(<JoinUserGroupForm />);

    const input = screen.getByLabelText('User Group Join Code');

    expect(input).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<JoinUserGroupForm />);

    const button = screen.getByRole('button', { name: /Join User Group/i });

    expect(button).toBeInTheDocument();
  });

  it('disables submit button by default', () => {
    render(<JoinUserGroupForm />);

    const button = screen.getByRole('button', { name: /Join User Group/i });

    expect(button).toBeDisabled();
  });

  it('enables submit button when input is valid', () => {
    render(<JoinUserGroupForm />);

    const input = screen.getByLabelText('User Group Join Code');
    const button = screen.getByRole('button', { name: /Join User Group/i });

    fireEvent.change(input, { target: { value: '12345678' } });

    expect(button).toBeEnabled();
  });

  it('calls api hook on submit', async () => {
    render(<JoinUserGroupForm />);

    await fillAndSubmitForm();

    expect(mutateAsync).toHaveBeenCalledWith({
      joinCode: '12345678',
    });
  });

  it('displays success notification on successful join', async () => {
    mutateAsync.mockResolvedValue({ label: 'test-label' });
    render(<JoinUserGroupForm />);

    await fillAndSubmitForm();

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'successful_operation',
          message: expect.stringContaining('test-label'),
        })
      );
    });
  });

  it('displays error notification if unable to join', async () => {
    mutateAsync.mockRejectedValue(new Error('Failed to join user group'));
    render(<JoinUserGroupForm />);

    await fillAndSubmitForm();

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'failed_operation',
        })
      );
    });
  });

  it('calls closeModalHandler upon successful request', async () => {
    const closeModalHandler = jest.fn();
    mutateAsync.mockResolvedValue({ label: 'test label' });
    render(<JoinUserGroupForm closeModalHandler={closeModalHandler} />);

    await fillAndSubmitForm();

    await waitFor(() => {
      expect(closeModalHandler).toHaveBeenCalled();
    });
  });
});
