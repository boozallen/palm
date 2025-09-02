import { render, screen, fireEvent } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';

import KbProviders from './KbProviders';

jest.mock('@mantine/hooks');

jest.mock('@/features/settings/components/kb-providers/modals/AddKbProviderModal', () => {
  return function MockAddKbProviderModal() {
    return <div>Mock Add Kb Provider Modal</div>;
  };
}
);
jest.mock('@/features/settings/components/kb-providers/tables/KbProvidersTable', () => {
  return function KbProvidersTable() {
    return <div>KB Providers Table</div>;
  };
});

describe('KbProviders', () => {
  const mockOpen = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: mockOpen, close: jest.fn() },
    ]);

    render(<KbProviders />);
  });

  it('renders header', () => {
    expect(screen.getByText('Knowledge Base Providers')).toBeInTheDocument();
  });

  it('renders action icon', () => {
    expect(screen.getByTestId('add-kb-provider-button')).toBeInTheDocument();
  });

  it('renders KbProvidersTable', () => {
    expect(screen.getByText('KB Providers Table')).toBeInTheDocument();
  });

  it('opens modal when action icon is clicked', () => {
    const actionIcon = screen.getByTestId('add-kb-provider-button');
    fireEvent.click(actionIcon);

    expect(mockOpen).toBeCalled();
  });
});
