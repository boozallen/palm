import { render, screen } from '@testing-library/react';
import StudioLoadError from './StudioLoadError';

describe('StudioLoadError', () => {
  it('shows the load failure message', () => {
    render(<StudioLoadError />);

    expect(screen.getByText('Could not load this view.')).toBeInTheDocument();
  });

  it('clarifies the failure is not an empty range', () => {
    render(<StudioLoadError />);

    expect(screen.getByText('This is a load failure, not an empty range — try again.')).toBeInTheDocument();
  });
});
