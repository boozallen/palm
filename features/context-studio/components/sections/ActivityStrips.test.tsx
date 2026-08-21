import { fireEvent, render, screen } from '@testing-library/react';
import { JSX } from 'react';
import { MantineProvider } from '@mantine/core';
import ActivityStrips from './ActivityStrips';
import { ActivityStats } from '@/features/context-studio/types/context-studio';
import { appTheme } from '@/providers/AppMantineProvider';

const renderWithTheme = (ui: JSX.Element) =>
  render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);

const stats: ActivityStats = {
  rangeStart: '2024-01-01T00:00:00.000Z',
  rangeEnd: '2024-01-03T00:00:00.000Z',
  users: [
    { id: 'u1', name: 'Ada Lovelace', isSelf: true },
    { id: 'u2', name: 'Bo Peep', isSelf: false },
  ],
  sessions: [
    {
      id: 'u1:1',
      userId: 'u1',
      userName: 'Ada Lovelace',
      startedAt: '2024-01-01T06:00:00.000Z',
      endedAt: '2024-01-01T07:00:00.000Z',
      eventCount: 9,
      path: ['Chat', 'Library', 'Document'],
      startedBySignIn: true,
      endedBySignOut: true,
    },
    {
      id: 'u2:1',
      userId: 'u2',
      userName: 'Bo Peep',
      startedAt: '2024-01-02T12:00:00.000Z',
      endedAt: '2024-01-02T12:01:00.000Z',
      eventCount: 1,
      path: ['Prompts'],
      startedBySignIn: false,
      endedBySignOut: false,
    },
  ],
  totalSessions: 2,
  totalEvents: 10,
  userCount: 2,
  signedInSessions: 1,
  signedOutSessions: 1,
};

// The block's accessible name is also its hover-card summary, so it doubles as
// the query handle in these tests.
const blockFor = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name},`) });

describe('ActivityStrips', () => {
  it('renders one row per user in the given display order', () => {
    renderWithTheme(<ActivityStrips stats={stats} loading={false} />);

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Bo Peep')).toBeInTheDocument();
  });

  it('renders one keyboard-focusable block per session, labelled with its times', () => {
    renderWithTheme(<ActivityStrips stats={stats} loading={false} />);

    const blocks = screen.getAllByRole('button');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toHaveAttribute('tabindex', '0');
    expect(blockFor('Ada Lovelace')).toHaveAccessibleName(/06:00–07:00, 9 events/);
    expect(blockFor('Bo Peep')).toHaveAccessibleName(/12:00–12:01, 1 event,/);
  });

  it('names each block with how its session opened and closed', () => {
    renderWithTheme(<ActivityStrips stats={stats} loading={false} />);

    expect(blockFor('Ada Lovelace')).toHaveAccessibleName(/signed in to signed out$/);
    expect(blockFor('Bo Peep')).toHaveAccessibleName(/resumed to still open$/);
  });

  it('renders the auth bookends on the card as chips outside the path', () => {
    renderWithTheme(<ActivityStrips stats={stats} loading={false} />);

    fireEvent.mouseEnter(blockFor('Bo Peep'));

    expect(screen.getByText('Resumed')).toBeInTheDocument();
    expect(screen.getByText('Still open')).toBeInTheDocument();
  });

  it('shows the session card with the full path on hover', () => {
    renderWithTheme(<ActivityStrips stats={stats} loading={false} />);

    fireEvent.mouseEnter(blockFor('Ada Lovelace'));

    expect(screen.getByText('9 events')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Document')).toBeInTheDocument();
  });

  it('shows the same card on keyboard focus and clears it on blur', () => {
    renderWithTheme(<ActivityStrips stats={stats} loading={false} />);
    const block = blockFor('Bo Peep');

    fireEvent.focus(block);
    expect(screen.getByText('Prompts')).toBeInTheDocument();

    fireEvent.blur(block);
    expect(screen.queryByText('Prompts')).not.toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    const { container } = renderWithTheme(<ActivityStrips stats={undefined} loading />);

    expect(container.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('No sessions in this range.')).not.toBeInTheDocument();
  });

  it('shows the empty message when no user has activity', () => {
    const empty: ActivityStats = {
      ...stats,
      users: [],
      sessions: [],
      totalSessions: 0,
      totalEvents: 0,
      userCount: 0,
    };

    renderWithTheme(<ActivityStrips stats={empty} loading={false} />);

    expect(screen.getByText('No sessions in this range.')).toBeInTheDocument();
  });

  it('shows the empty message when stats have not resolved', () => {
    renderWithTheme(<ActivityStrips stats={undefined} loading={false} />);

    expect(screen.getByText('No sessions in this range.')).toBeInTheDocument();
  });

  // A rejected query also leaves stats undefined, so without a distinct failure
  // state a broken panel reads as a genuinely empty range.
  it('distinguishes a load failure from an empty range', () => {
    renderWithTheme(<ActivityStrips stats={undefined} loading={false} failed />);

    expect(screen.getByText('Could not load this view.')).toBeInTheDocument();
    expect(screen.queryByText('No sessions in this range.')).not.toBeInTheDocument();
  });
});
