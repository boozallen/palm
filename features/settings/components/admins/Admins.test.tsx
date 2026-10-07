import { render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';

import Admins from './Admins';

jest.mock('@mantine/hooks');

jest.mock('./modals/AddAdminModal', () => {
  return function AddAdminModal() {
    return <div>Add Admin Modal</div>;
  };
});

jest.mock('./tables/AdminsTable', () => {
  return function AdminsTable() {
    return <div>Admins Table</div>;
  };
});

describe('Admins', () => {

  const openMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: openMock, close: jest.fn() },
    ]);
  });
  it('renders header with icon', () => {
    render(<Admins />);

    expect(screen.getByText('Admins')).toBeInTheDocument();
    expect(screen.getByTestId('add-admin-button')).toBeInTheDocument();
  });

  it('renders AdminsTable', () => {
    render(<Admins />);

    expect(screen.getByText('Admins Table')).toBeInTheDocument();
  });

  it('renders AddAdminModal', () => {
    render(<Admins />);

    expect(screen.getByText('Add Admin Modal')).toBeInTheDocument();
  });

  it('opens AddAdminModal when add admin button is clicked', () => {
    render(<Admins />);

    screen.getByTestId('add-admin-button').click();

    expect(openMock).toHaveBeenCalledTimes(1);
  });
});
