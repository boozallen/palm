import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import HoverPopover from './HoverPopover';

function renderPopover(targetTestId: string, content: string) {
  return render(
    <MantineProvider theme={{ colorScheme: 'dark' }}>
      <HoverPopover
        target={<div data-testid={targetTestId}>Trigger</div>}
      >
        {content}
      </HoverPopover>
    </MantineProvider>,
  );
}

describe('HoverPopover', () => {
  it('renders the trigger element', () => {
    renderPopover('test-trigger', 'Popover content');
    expect(screen.getByTestId('test-trigger')).toBeInTheDocument();
  });

  it('does not show popover content before hover', () => {
    renderPopover('test-trigger', 'Popover content');
    expect(screen.queryByTestId('hover-popover-content')).not.toBeInTheDocument();
  });

  it('shows popover content on hover', async () => {
    const user = userEvent.setup();
    renderPopover('test-trigger', 'Popover content');

    const trigger = screen.getByTestId('test-trigger');
    await user.hover(trigger);

    expect(screen.getByTestId('hover-popover-content')).toBeInTheDocument();
  });
});
