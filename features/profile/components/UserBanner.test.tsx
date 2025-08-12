import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { signOut } from 'next-auth/react';
import { UserBanner } from './UserBanner';
import { UserSessionContext } from '@/components/layouts/AuthWrap';
import { useLogout } from '@/providers/LogoutProvider';

jest.mock('next-auth/react');
jest.mock('@/components/layouts/AuthWrap');
jest.mock('@/providers/LogoutProvider');

describe('UserBanner', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls signOut when the logout button is clicked', () => {
    const mockUserSession = { user: { name: 'Test', email: 'test@test.com', image: 'test.jpg' }, expires: '2024-12-31T00:00:00.000Z' };
    const setIsUserLoggingOut = jest.fn();

    (useLogout as jest.Mock).mockReturnValue({ setIsUserLoggingOut });
    (signOut as jest.Mock).mockResolvedValue(null);

    const { getByText } = render(
      <UserSessionContext.Provider value={mockUserSession}>
        <UserBanner />
      </UserSessionContext.Provider>
    );

    fireEvent.click(getByText('Logout'));

    expect(signOut).toHaveBeenCalled();
  });

  it('handles error during sign out', async () => {
    const mockUserSession = { user: { name: 'Test', email: 'test@test.com', image: 'test.jpg' }, expires: '2024-12-31T00:00:00.000Z' };
    const setIsUserLoggingOut = jest.fn();
    const error = new Error('Sign out error');

    (useLogout as jest.Mock).mockReturnValue({ setIsUserLoggingOut });
    (signOut as jest.Mock).mockRejectedValue(error);

    const { getByText, getByRole } = render(
      <UserSessionContext.Provider value={mockUserSession}>
        <UserBanner />
      </UserSessionContext.Provider>
    );

    fireEvent.click(getByText('Logout'));

    const modalMessage = await waitFor(() => getByRole('dialog'));
    expect(modalMessage).toHaveTextContent('Logout failed. Please try again.');

    fireEvent.click(getByText('Close'));

    await waitFor(() => expect(modalMessage).not.toBeInTheDocument());
  });
});
