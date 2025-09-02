import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import UserGroupJoinCode from './UserGroupJoinCode';
import { notifications } from '@mantine/notifications';
import useGenerateUserGroupJoinCode from '@/features/settings/api/user-groups/generate-user-group-join-code';

jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

jest.mock('@/features/settings/api/user-groups/generate-user-group-join-code', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('UserGroupJoinCode', () => {
  const mockId = 'test-user-group-id';
  const initialJoinCode = '12345678';
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGenerateUserGroupJoinCode as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  it('renders the join code and buttons correctly ', () => {
    render(<UserGroupJoinCode id={mockId} currentJoinCode={initialJoinCode} />);
    
    const joinCodeLabel = screen.getByTestId('user-group-join-code-label');
    const copyButton = screen.getByRole('button', { name: initialJoinCode });
    const generateButton = screen.getByTestId('generate-user-group-join-code-button');
    
    expect(joinCodeLabel).toHaveTextContent('Join Code:');
    expect(copyButton).toHaveTextContent(initialJoinCode);
    expect(generateButton).toBeInTheDocument();
  });

  it('renders button with label None and disables copy button when no join code exists', () => {
    render(<UserGroupJoinCode id={mockId} currentJoinCode={null} />);
    
    const copyButton = screen.getByRole('button', { name: 'None' });
    const generateButton = screen.getByTestId('generate-user-group-join-code-button');
    
    expect(copyButton).toHaveTextContent('None');
    expect(copyButton).toBeDisabled();
    expect(generateButton).toHaveAttribute('aria-label', 'Generate user group join code');
  });

  it('displays success notification when join code is generated for the first time', async () => {
    render(<UserGroupJoinCode id={mockId} currentJoinCode={null} />);

    const generateButton = screen.getByTestId('generate-user-group-join-code-button');
    fireEvent.click(generateButton);

    expect(mockMutate).toHaveBeenCalledWith(
      { userGroupId: mockId },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );

    const mutateCall = mockMutate.mock.calls[0];
    const successCallback = mutateCall[1].onSuccess;
    
    await act(async () => {
      successCallback({ joinCode: 'NEW12345' });
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'generate-join-code-success',
        title: 'Join Code Generated',
        message: 'Successfully generated user group join code.',
        icon: expect.anything(),
        variant: 'successful_operation',
      });
    });
  });

  it('displays success notification when join code is regenerated', async () => {
    render(<UserGroupJoinCode id={mockId} currentJoinCode={initialJoinCode} />);

    const generateButton = screen.getByTestId('generate-user-group-join-code-button');
    fireEvent.click(generateButton);

    const mutateCall = mockMutate.mock.calls[0];
    const successCallback = mutateCall[1].onSuccess;
    
    await act(async () => {
      successCallback({ joinCode: 'NEW12345' });
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'generate-join-code-success',
        title: 'Join Code Regenerated',
        message: 'Successfully regenerated user group join code.',
        icon: expect.anything(),
        variant: 'successful_operation',
      });
    });
  });

  it('displays error notification when generation fails', async () => {
    render(<UserGroupJoinCode id={mockId} currentJoinCode={initialJoinCode} />);

    const generateButton = screen.getByTestId('generate-user-group-join-code-button');
    fireEvent.click(generateButton);

    const mutateCall = mockMutate.mock.calls[0];
    const errorCallback = mutateCall[1].onError;
    
    await act(async () => {
      errorCallback({ message: 'Custom error message' });
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'generate-join-code-error',
        title: 'Failed to Generate Group Join Code',
        message: 'Custom error message',
        icon: expect.anything(),
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });
});

