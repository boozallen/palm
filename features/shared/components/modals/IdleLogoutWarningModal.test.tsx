import { render, screen, fireEvent } from '@testing-library/react';

import IdleLogoutWarningModal from './IdleLogoutWarningModal';

describe('IdleLogoutWarningModal', () => {
  const onExtendSessionMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal when isOpen is true', () => {
    render(
      <IdleLogoutWarningModal
        isOpen={true}
        onExtendSession={onExtendSessionMock}
        timeRemainingMS={300000}
      />
    );

    expect(screen.getByText('Are you still there?')).toBeInTheDocument();
    expect(screen.getByText('Continue session')).toBeInTheDocument();
  });

  it('does not render the modal when isOpen is false', () => {
    render(
      <IdleLogoutWarningModal
        isOpen={false}
        onExtendSession={onExtendSessionMock}
        timeRemainingMS={300000}
      />
    );

    expect(screen.queryByText('Are you still there?')).not.toBeInTheDocument();
    expect(screen.queryByText('Continue session')).not.toBeInTheDocument();
  });

  it('displays instructional text about extending session', () => {
    render(
      <IdleLogoutWarningModal
        isOpen={true}
        onExtendSession={onExtendSessionMock}
        timeRemainingMS={300000}
      />
    );

    expect(screen.getByText('Continue session')).toBeInTheDocument();
  });

  it('calls onExtendSession when "Continue session" button is clicked', () => {
    render(
      <IdleLogoutWarningModal
        isOpen={true}
        onExtendSession={onExtendSessionMock}
        timeRemainingMS={300000}
      />
    );

    fireEvent.click(screen.getByText('Continue session'));

    expect(onExtendSessionMock).toHaveBeenCalledTimes(1);
  });

  it('formats time correctly with leading zero for seconds', () => {
    render(
      <IdleLogoutWarningModal
        isOpen={true}
        onExtendSession={onExtendSessionMock}
        timeRemainingMS={125000}
      />
    );

    expect(screen.getByText(/2:05/)).toBeInTheDocument();
  });

  it('formats time correctly for exactly 60 seconds', () => {
    render(
      <IdleLogoutWarningModal
        isOpen={true}
        onExtendSession={onExtendSessionMock}
        timeRemainingMS={60000}
      />
    );

    expect(screen.getByText(/1:00/)).toBeInTheDocument();
  });
});
