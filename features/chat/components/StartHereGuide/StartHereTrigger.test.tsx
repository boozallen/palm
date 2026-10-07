import { renderWrapper } from '@/test/test-utils';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StartHereTrigger } from './StartHereTrigger';

describe('StartHereTrigger', () => {
  it('shows the "See what you can do in PALM" label once seen', () => {
    renderWrapper(<StartHereTrigger hasSeen onExpand={jest.fn()} />);
    expect(screen.getByRole('button', { name: /see what you can do in palm/i })).toBeInTheDocument();
  });

  it('shows the first-visit label when not yet seen', () => {
    renderWrapper(<StartHereTrigger hasSeen={false} onExpand={jest.fn()} />);
    expect(screen.getByRole('button', { name: /start here — see how it works/i })).toBeInTheDocument();
  });

  it('calls onExpand when clicked', async () => {
    const user = userEvent.setup();
    const onExpand = jest.fn();
    renderWrapper(<StartHereTrigger hasSeen onExpand={onExpand} />);

    await user.click(screen.getByTestId('start-here-trigger'));

    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});
