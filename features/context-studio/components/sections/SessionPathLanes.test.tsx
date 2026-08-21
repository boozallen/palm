import { render, screen } from '@testing-library/react';
import { JSX } from 'react';
import { MantineProvider } from '@mantine/core';
import SessionPathLanes from './SessionPathLanes';
import { SessionPathStats } from '@/features/context-studio/types/context-studio';
import { appTheme } from '@/providers/AppMantineProvider';

const renderWithTheme = (ui: JSX.Element) =>
  render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);

const stats: SessionPathStats = {
  paths: [
    {
      id: 'p1',
      count: 12,
      steps: ['Chat', 'Library', 'Document'],
      sampleUser: 'Ada Lovelace',
      window: '09:00–09:42',
    },
    {
      id: 'p2',
      count: 1,
      steps: ['Prompts', 'Chat'],
      sampleUser: 'Bo Peep',
      window: '14:00–14:05',
    },
    {
      id: 'other',
      count: 5,
      steps: ['Other paths', '3 distinct paths'],
      sampleUser: '—',
      window: '',
      isOther: true,
    },
  ],
  totalSessions: 18,
  totalEvents: 60,
  totalNavigations: 40,
};

describe('SessionPathLanes', () => {
  it('renders one keyboard-focusable lane per path with its count and steps', () => {
    renderWithTheme(<SessionPathLanes stats={stats} loading={false} />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Document')).toBeInTheDocument();
    // 'Chat' is a step in two lanes, so it is expected twice.
    expect(screen.getAllByText('Chat')).toHaveLength(2);
    expect(screen.getByLabelText('12 sessions: Chat then Library then Document'))
      .toHaveAttribute('tabindex', '0');
  });

  it('renders the step count and clock window for a real path', () => {
    renderWithTheme(<SessionPathLanes stats={stats} loading={false} />);

    expect(screen.getByText('3 steps · 09:00–09:42')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('singularizes the sessions caption for a one-session lane', () => {
    renderWithTheme(<SessionPathLanes stats={stats} loading={false} />);

    expect(screen.getByText('session')).toBeInTheDocument();
    expect(screen.getAllByText('sessions')).toHaveLength(2);
  });

  it('marks the Other bucket as bucketed rather than as a real journey', () => {
    renderWithTheme(<SessionPathLanes stats={stats} loading={false} />);

    expect(screen.getByText('Other paths')).toBeInTheDocument();
    expect(screen.getByText('3 distinct paths')).toBeInTheDocument();
    expect(screen.getByText('bucketed')).toBeInTheDocument();
  });

  it('renders ghost lanes while loading', () => {
    const { container } = renderWithTheme(<SessionPathLanes stats={undefined} loading />);

    expect(container.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('No paths recorded in this range.')).not.toBeInTheDocument();
  });

  it('shows the empty message when there are no paths', () => {
    renderWithTheme(
      <SessionPathLanes
        stats={{ paths: [], totalSessions: 0, totalEvents: 0, totalNavigations: 0 }}
        loading={false}
      />,
    );

    expect(screen.getByText('No paths recorded in this range.')).toBeInTheDocument();
  });

  it('shows the empty message when stats have not resolved', () => {
    renderWithTheme(<SessionPathLanes stats={undefined} loading={false} />);

    expect(screen.getByText('No paths recorded in this range.')).toBeInTheDocument();
  });

  // A rejected query also leaves stats undefined, so without a distinct failure
  // state a broken panel reads as a genuinely empty range.
  it('distinguishes a load failure from an empty range', () => {
    renderWithTheme(<SessionPathLanes stats={undefined} loading={false} failed />);

    expect(screen.getByText('Could not load this view.')).toBeInTheDocument();
    expect(screen.queryByText('No paths recorded in this range.')).not.toBeInTheDocument();
  });
});
