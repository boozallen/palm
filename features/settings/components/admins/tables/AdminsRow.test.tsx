import { render, screen } from '@testing-library/react';
import { useSession } from 'next-auth/react';

import AdminsRow from './AdminsRow';
import { useDisclosure } from '@mantine/hooks';

jest.mock('next-auth/react');
jest.mock('@mantine/hooks');

jest.mock('@/features/settings/components/admins/modals/RemoveAdminModal', () => {
  return function MockRemoveAdminModal() {
    return <tr><td>Mock Remove Admin Modal</td></tr>;
  };
});

describe('AdminsRow', () => {
  const mockUserId = '655869a5-0d32-40c9-9b77-fc231204ed03';

  const mockAdmin = {
    id: '0499945a-5bb1-4a13-9850-f8424654d003',
    name: 'Doe, Alex [USA]',
    email: 'doe_alex@domain.com',
  };

  const openMock = jest.fn();

  const container = document.body
    .appendChild(document.createElement('table'))
    .appendChild(document.createElement('tbody'));

  beforeEach(() => {
    jest.clearAllMocks();

    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          id: mockUserId,
        },
      },
    });

    (useDisclosure as jest.Mock).mockReturnValue([
      false, { open: openMock, close: jest.fn() },
    ]);
  });

  it('renders name, email and action icon', () => {
    render(<AdminsRow {...mockAdmin} />, { container });

    expect(screen.getByText(mockAdmin.name)).toBeInTheDocument();
    expect(screen.getByText(mockAdmin.email)).toBeInTheDocument();
    expect(screen.getByTestId('remove-admin-button')).toBeInTheDocument();
  });

  it('hides action icon for current admin', () => {
    render(<AdminsRow {...mockAdmin} id={mockUserId}/>, { container });

    expect(screen.queryByTestId('remove-admin-button')).not.toBeInTheDocument();
  });

  it('opens modal when action icon is clicked', () => {
    render(<AdminsRow {...mockAdmin} />, { container });

    screen.getByTestId('remove-admin-button').click();
    expect(openMock).toHaveBeenCalledTimes(1);
  });
});
