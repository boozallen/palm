import { act, render, screen } from '@testing-library/react';
import JoinUserGroupWrap from './JoinUserGroupWrap';
import { useJoinUserGroupCallout } from '@/features/shared/components/JoinUserGroupCallout/JoinUserGroupCalloutProvider';

jest.mock('@/features/shared/components/JoinUserGroupCallout/JoinUserGroupCalloutProvider');
jest.mock('@/features/shared/components/JoinUserGroupCallout/JoinUserGroupDialog', () => {
  return jest.fn(({ opened, collapsed }: { opened: boolean; collapsed: boolean }) =>
    opened ? <div data-testid={collapsed ? 'dialog-collapsed' : 'dialog-expanded'} /> : null
  );
});

const mockUseCallout = (overrides: Partial<ReturnType<typeof useJoinUserGroupCallout>> = {}) => {
  (useJoinUserGroupCallout as jest.Mock).mockReturnValue({
    isNonMember: false,
    collapsed: false,
    collapse: jest.fn(),
    expand: jest.fn(),
    focusRequestId: 0,
    requestExpandAndFocus: jest.fn(),
    blockingModalOpen: false,
    setBlockingModalOpen: jest.fn(),
    ...overrides,
  });
};

const DIALOG_APPEARANCE_DELAY_MS = 2000;

describe('JoinUserGroupWrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const advancePastDelay = () => {
    act(() => {
      jest.advanceTimersByTime(DIALOG_APPEARANCE_DELAY_MS);
    });
  };

  it('renders children', () => {
    mockUseCallout();

    render(<JoinUserGroupWrap><div data-testid='child' /></JoinUserGroupWrap>);

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('opens the dialog expanded when the user is a non-member', () => {
    mockUseCallout({ isNonMember: true, collapsed: false });

    render(<JoinUserGroupWrap><div data-testid='child' /></JoinUserGroupWrap>);
    advancePastDelay();

    expect(screen.getByTestId('dialog-expanded')).toBeInTheDocument();
  });

  it('opens the dialog collapsed when collapsed is set', () => {
    mockUseCallout({ isNonMember: true, collapsed: true });

    render(<JoinUserGroupWrap><div data-testid='child' /></JoinUserGroupWrap>);
    advancePastDelay();

    expect(screen.getByTestId('dialog-collapsed')).toBeInTheDocument();
  });

  it('does not open the dialog when the user is a member', () => {
    mockUseCallout({ isNonMember: false });

    render(<JoinUserGroupWrap><div data-testid='child' /></JoinUserGroupWrap>);
    advancePastDelay();

    expect(screen.queryByTestId('dialog-expanded')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dialog-collapsed')).not.toBeInTheDocument();
  });

  it('does not open the dialog while a blocking modal is open', () => {
    mockUseCallout({ isNonMember: true, collapsed: false, blockingModalOpen: true });

    render(<JoinUserGroupWrap><div data-testid='child' /></JoinUserGroupWrap>);
    advancePastDelay();

    expect(screen.queryByTestId('dialog-expanded')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dialog-collapsed')).not.toBeInTheDocument();
  });
});
