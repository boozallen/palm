import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import UserGroupMonthlyBudget from './UserGroupMonthlyBudget';
import { notifications } from '@mantine/notifications';
import useUpdateUserGroupMonthlyBudget from '@/features/settings/api/user-groups/update-user-group-monthly-budget';

jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

jest.mock('@/features/settings/api/user-groups/update-user-group-monthly-budget', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('UserGroupMonthlyBudget', () => {
  const mockId = 'test-user-group-id';
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useUpdateUserGroupMonthlyBudget as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  it('renders the label, input, and save button', () => {
    render(<UserGroupMonthlyBudget id={mockId} currentMonthlyBudget={500} />);

    const label = screen.getByText('Manage monthly budget');
    const input = screen.getByTestId('user-group-monthly-budget-input');
    const saveButton = screen.getByTestId('save-user-group-monthly-budget-button');

    expect(label).toBeInTheDocument();
    expect(input).toHaveValue('500.00');
    expect(saveButton).toBeInTheDocument();
  });

  it('renders an empty input when there is no current monthly budget', () => {
    render(<UserGroupMonthlyBudget id={mockId} currentMonthlyBudget={null} />);

    const input = screen.getByTestId('user-group-monthly-budget-input');
    expect(input).toHaveValue('');
  });

  it('disables the save button until the value changes', () => {
    render(<UserGroupMonthlyBudget id={mockId} currentMonthlyBudget={500} />);

    const saveButton = screen.getByTestId('save-user-group-monthly-budget-button');
    expect(saveButton).toBeDisabled();

    const input = screen.getByTestId('user-group-monthly-budget-input');
    fireEvent.change(input, { target: { value: '750' } });

    expect(saveButton).not.toBeDisabled();
  });

  it('saves the new monthly budget and shows a success notification', async () => {
    render(<UserGroupMonthlyBudget id={mockId} currentMonthlyBudget={500} />);

    const input = screen.getByTestId('user-group-monthly-budget-input');
    fireEvent.change(input, { target: { value: '750' } });

    const saveButton = screen.getByTestId('save-user-group-monthly-budget-button');
    fireEvent.click(saveButton);

    expect(mockMutate).toHaveBeenCalledWith(
      { userGroupId: mockId, monthlyBudget: 750 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );

    const mutateCall = mockMutate.mock.calls[0];
    const successCallback = mutateCall[1].onSuccess;

    await act(async () => {
      successCallback();
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'update-user-group-monthly-budget-success',
        title: 'Monthly Budget Updated',
        message: 'Successfully updated user group monthly budget.',
        icon: expect.anything(),
        variant: 'successful_operation',
      });
    });
  });

  it('saves a cleared monthly budget as null', () => {
    render(<UserGroupMonthlyBudget id={mockId} currentMonthlyBudget={500} />);

    const input = screen.getByTestId('user-group-monthly-budget-input');
    fireEvent.change(input, { target: { value: '' } });

    const saveButton = screen.getByTestId('save-user-group-monthly-budget-button');
    fireEvent.click(saveButton);

    expect(mockMutate).toHaveBeenCalledWith(
      { userGroupId: mockId, monthlyBudget: null },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it('renders the monthly and total spend rollup with token counts', () => {
    render(
      <UserGroupMonthlyBudget
        id={mockId}
        currentMonthlyBudget={500}
        totalSpend={1234.56}
        monthlySpend={100}
        totalTokens={2500000}
        monthlyTokens={700}
      />
    );

    expect(screen.getByTestId('user-group-monthly-spend')).toHaveTextContent('$100.00 · 700 tokens');
    expect(screen.getByTestId('user-group-total-spend')).toHaveTextContent('$1,234.56 · 2.5M tokens');
  });

  it('defaults spend and token values to 0 when not provided', () => {
    render(<UserGroupMonthlyBudget id={mockId} currentMonthlyBudget={null} />);

    expect(screen.getByTestId('user-group-monthly-spend')).toHaveTextContent('$0.00 · 0 tokens');
    expect(screen.getByTestId('user-group-total-spend')).toHaveTextContent('$0.00 · 0 tokens');
  });

  it('flags monthly spend as over budget when spend meets or exceeds the budget', () => {
    render(
      <UserGroupMonthlyBudget
        id={mockId}
        currentMonthlyBudget={500}
        totalSpend={600}
        monthlySpend={600}
        monthlyTokens={1200}
      />
    );

    expect(screen.queryByTestId('user-group-monthly-spend')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-group-monthly-spend-over-limit')).toHaveTextContent('$600.00 · 1.2K tokens');
  });

  it('displays an error notification when saving fails', async () => {
    render(<UserGroupMonthlyBudget id={mockId} currentMonthlyBudget={500} />);

    const input = screen.getByTestId('user-group-monthly-budget-input');
    fireEvent.change(input, { target: { value: '750' } });

    const saveButton = screen.getByTestId('save-user-group-monthly-budget-button');
    fireEvent.click(saveButton);

    const mutateCall = mockMutate.mock.calls[0];
    const errorCallback = mutateCall[1].onError;

    await act(async () => {
      errorCallback({ message: 'Custom error message' });
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'update-user-group-monthly-budget-error',
        title: 'Failed to Update Monthly Budget',
        message: 'Custom error message',
        icon: expect.anything(),
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });
});
