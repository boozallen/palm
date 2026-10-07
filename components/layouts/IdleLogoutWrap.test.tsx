import { render, screen, fireEvent } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useIdle } from '@mantine/hooks';

import IdleLogoutWrap from './IdleLogoutWrap';
import { useLogout } from '@/providers/LogoutProvider';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import { UserRole } from '@/features/shared/types/user';

jest.mock('next-auth/react');
jest.mock('@mantine/hooks', () => ({
  ...jest.requireActual('@mantine/hooks'),
  useIdle: jest.fn(),
}));
jest.mock('@/providers/LogoutProvider');
jest.mock('@/features/shared/hooks/useTrackClientEvent');

const mockShown = jest.fn();
const mockExtendSessionClicked = jest.fn();

function mockIdleState(isIdleForWarning: boolean, isIdleForLogout: boolean) {
  let callCount = 0;
  (useIdle as jest.Mock).mockImplementation(() => {
    callCount += 1;
    return callCount % 2 === 1 ? isIdleForWarning : isIdleForLogout;
  });
}

describe('IdleLogoutWrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ data: { user: { role: UserRole.User } } });
    (useLogout as jest.Mock).mockReturnValue({ setIsUserLoggingOut: jest.fn() });
    (useTrackClientEvent as jest.Mock).mockReturnValue({
      idleWarningModal: {
        shown: mockShown,
        extendSessionClicked: mockExtendSessionClicked,
      },
    });
  });

  it('does not record the warning modal being shown while the user is active', () => {
    mockIdleState(false, false);

    render(<IdleLogoutWrap><div /></IdleLogoutWrap>);

    expect(mockShown).not.toHaveBeenCalled();
  });

  it('records the warning modal being shown once the user is idle for the warning threshold', () => {
    mockIdleState(true, false);

    render(<IdleLogoutWrap><div /></IdleLogoutWrap>);

    expect(screen.getByText('Are you still there?')).toBeInTheDocument();
    expect(mockShown).toHaveBeenCalledTimes(1);
  });

  it('records the user clicking "Continue session" on the warning modal', () => {
    mockIdleState(true, false);

    render(<IdleLogoutWrap><div /></IdleLogoutWrap>);
    fireEvent.click(screen.getByText('Continue session'));

    expect(mockExtendSessionClicked).toHaveBeenCalledTimes(1);
  });
});
