import { fireEvent, render, screen } from '@testing-library/react';

import CopyEntryContent from './CopyEntryContent';

describe('CopyEntryContent', () => {
  const mockProps = {
    messageContent: 'This is a test message',
  };

  beforeEach(jest.clearAllMocks);

  it('renders action icon', () => {
    render(<CopyEntryContent {...mockProps} />);

    const actionIcon = screen.getByTestId('copy-button');

    expect(actionIcon).toBeInTheDocument();
  });

  it('does not display tooltip by default', async () => {
    render(<CopyEntryContent {...mockProps} />);

    expect(screen.queryByText('Copy Message')).not.toBeInTheDocument();
  });

  it('displays tooltip on hover', async () => {
    render(<CopyEntryContent {...mockProps} />);

    const actionIcon = screen.getByTestId('copy-button');
    fireEvent.mouseEnter(actionIcon);

    const tooltip = await screen.findByText('Copy Message');

    expect(tooltip).toBeInTheDocument();
  });

  it('displays IconCopy', () => {
    render(<CopyEntryContent {...mockProps} />);

    const iconCopy = screen.getByTestId('copy-icon');

    expect(iconCopy).toBeInTheDocument();
  });
});
