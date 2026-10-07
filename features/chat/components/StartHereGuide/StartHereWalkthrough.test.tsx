import { renderWrapper } from '@/test/test-utils';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StartHereWalkthrough } from './StartHereWalkthrough';

jest.mock('@mantine/hooks', () => ({
  ...jest.requireActual('@mantine/hooks'),
  useReducedMotion: () => true,
}));

describe('StartHereWalkthrough', () => {
  it('renders the guided sequence', () => {
    renderWrapper(<StartHereWalkthrough onClose={jest.fn()} />);
    expect(screen.getByTestId('start-here-sequence')).toBeInTheDocument();
  });

  it('calls onClose when the close control is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    renderWrapper(<StartHereWalkthrough onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the sequence completes', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    renderWrapper(<StartHereWalkthrough onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /done/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
