import { render, screen } from '@testing-library/react';
import { StudioStat } from './StudioPanel';

describe('StudioStat', () => {
  it('renders a resolved value with thousands separators', () => {
    render(<StudioStat value={1529} label='events' loading={false} />);

    expect(screen.getByText('1,529')).toBeInTheDocument();
    expect(screen.getByText('events')).toBeInTheDocument();
  });

  it('renders a placeholder while loading', () => {
    render(<StudioStat value={undefined} label='events' loading />);

    expect(screen.getByText('–')).toBeInTheDocument();
  });

  it('renders a placeholder rather than a zero when the query failed', () => {
    render(<StudioStat value={undefined} label='events' loading={false} failed />);

    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
