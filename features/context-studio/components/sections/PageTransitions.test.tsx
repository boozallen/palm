import { fireEvent, render, screen } from '@testing-library/react';
import PageTransitions from './PageTransitions';
import { PageTransitionStats } from '@/features/context-studio/types/context-studio';

const stats: PageTransitionStats = {
  pages: ['Chat', 'Prompt Library', 'Prompts'],
  matrix: {
    Chat: { 'Prompt Library': 6, Prompts: 2, Chat: 4 },
    'Prompt Library': { Chat: 3 },
    Prompts: {},
  },
  totalTransitions: 15,
};

describe('PageTransitions', () => {
  it('renders a row and column for every page, in full', () => {
    render(<PageTransitions stats={stats} loading={false} />);

    // Row labels and column headers both carry the full, unabbreviated name.
    expect(screen.getAllByText('Prompt Library')).toHaveLength(2);
  });

  it('renders one keyboard-focusable cell per off-diagonal pair', () => {
    render(<PageTransitions stats={stats} loading={false} />);

    // 3x3 grid minus the 3 diagonal cells.
    const cells = screen.getAllByRole('button');
    expect(cells).toHaveLength(6);
    expect(cells[0]).toHaveAttribute('tabindex', '0');
    expect(screen.getByLabelText('Chat to Prompt Library, 6 transitions')).toBeInTheDocument();
    expect(screen.getByLabelText('Prompts to Chat, 0 transitions')).toBeInTheDocument();
  });

  it('shows the default readout before any hover', () => {
    render(<PageTransitions stats={stats} loading={false} />);

    expect(screen.getByText('Hover a cell — row = from · column = to')).toBeInTheDocument();
  });

  it('reads out the count and share of the row exits on cell hover', () => {
    render(<PageTransitions stats={stats} loading={false} />);

    fireEvent.mouseEnter(screen.getByLabelText('Chat to Prompt Library, 6 transitions'));

    // Chat's exits exclude its own diagonal: 6 + 2 = 8, so 6 is 75%.
    expect(screen.getByText('Chat → Prompt Library 6 transitions · 75% of Chat\'s exits'))
      .toBeInTheDocument();
  });

  it('reads out "no transitions" for an empty pair', () => {
    render(<PageTransitions stats={stats} loading={false} />);

    fireEvent.mouseEnter(screen.getByLabelText('Prompts to Chat, 0 transitions'));

    expect(screen.getByText('Prompts → Chat no transitions')).toBeInTheDocument();
  });

  it('reads out on keyboard focus too', () => {
    render(<PageTransitions stats={stats} loading={false} />);

    fireEvent.focus(screen.getByLabelText('Prompt Library to Chat, 3 transitions'));

    expect(screen.getByText(/^Prompt Library → Chat 3 transitions/)).toBeInTheDocument();
  });

  it('excludes the diagonal from each row exit total', () => {
    render(<PageTransitions stats={stats} loading={false} />);

    // Chat's row shows 8, not 12 — the 4 self-transitions are not exits.
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('excludes the diagonal from the heat scale in the legend', () => {
    render(<PageTransitions stats={stats} loading={false} />);

    // Max off-diagonal value is 6; the diagonal's 4 never competes.
    expect(screen.getByText('6 transitions')).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    const { container } = render(<PageTransitions stats={undefined} loading />);

    expect(container.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('No page transitions in this range.')).not.toBeInTheDocument();
  });

  it('shows the empty message when there are no pages', () => {
    render(
      <PageTransitions
        stats={{ pages: [], matrix: {}, totalTransitions: 0 }}
        loading={false}
      />,
    );

    expect(screen.getByText('No page transitions in this range.')).toBeInTheDocument();
  });

  it('shows the empty message when stats have not resolved', () => {
    render(<PageTransitions stats={undefined} loading={false} />);

    expect(screen.getByText('No page transitions in this range.')).toBeInTheDocument();
  });

  // A rejected query also leaves stats undefined, so without a distinct failure
  // state a broken panel reads as a genuinely empty range.
  it('distinguishes a load failure from an empty range', () => {
    render(<PageTransitions stats={undefined} loading={false} failed />);

    expect(screen.getByText('Could not load this view.')).toBeInTheDocument();
    expect(screen.queryByText('No page transitions in this range.')).not.toBeInTheDocument();
  });
});
