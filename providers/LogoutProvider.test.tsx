import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoutProvider, useLogout } from './LogoutProvider';

const MockChild: React.FC = () => {
  const { isUserLoggingOut, setIsUserLoggingOut } = useLogout();

  const handleClick = () => {
    setIsUserLoggingOut(true);
  };

  return (
    <div>
      <p>{isUserLoggingOut ? 'Logging out...' : 'Not logging out'}</p>
      <button onClick={handleClick}>Set Is Logging Out</button>
    </div>
  );
};

describe('LogoutProvider', () => {
  it('renders children and initializes isUserLoggingOut to false', () => {
    const { getByText } = render(
      <LogoutProvider>
        <MockChild />
      </LogoutProvider>
    );

    expect(getByText('Not logging out')).toBeInTheDocument();
  });

  it('updates isUserLoggingOut state correctly when setIsUserLoggingOut is called', () => {
    const { getByText } = render(
      <LogoutProvider>
        <MockChild />
      </LogoutProvider>
    );

    const button = getByText('Set Is Logging Out');
    userEvent.click(button);

    expect(getByText('Set Is Logging Out')).toBeInTheDocument();
  });
});
