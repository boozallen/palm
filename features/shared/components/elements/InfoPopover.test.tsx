import { fireEvent, render, screen } from '@testing-library/react';
import InfoPopover from './InfoPopover';

jest.mock('@mantine/core', () => {
  const actualMantine = jest.requireActual('@mantine/core');
  return {
    ...actualMantine,
    Popover: Object.assign(
      ({ children, opened }: { children: React.ReactNode; opened: boolean }) => (
        <div data-testid='mock-popover' data-opened={opened}>{children}</div>
      ),
      {
        Target: ({ children }: { children: React.ReactNode }) => (
          <div data-testid='mock-popover-target'>{children}</div>
        ),
        Dropdown: ({ children }: { children: React.ReactNode }) => (
          <div data-testid='mock-popover-dropdown'>{children}</div>
        ),
      },
    ),
  };
});

describe('InfoPopover', () => {
  const defaultProps = {
    label: 'Temperature',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the info icon', () => {
    render(<InfoPopover {...defaultProps} />);

    expect(screen.getByTestId('mock-popover-target')).toBeInTheDocument();
  });

  it('opens popover on mouse enter and closes on mouse leave', () => {
    render(<InfoPopover {...defaultProps} />);

    const popover = screen.getByTestId('mock-popover');
    const target = screen.getByTestId('mock-popover-target');
    const icon = target.firstChild as HTMLElement;

    expect(popover).toHaveAttribute('data-opened', 'false');

    fireEvent.mouseEnter(icon);
    expect(screen.getByTestId('mock-popover')).toHaveAttribute('data-opened', 'true');

    fireEvent.mouseLeave(icon);
    expect(screen.getByTestId('mock-popover')).toHaveAttribute('data-opened', 'false');
  });
});
