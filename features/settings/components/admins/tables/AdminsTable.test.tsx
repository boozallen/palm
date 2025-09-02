import { render, screen } from '@testing-library/react';

import useGetSystemAdmins from '@/features/settings/api/admins/get-system-admins';
import AdminsTable from './AdminsTable';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';

jest.mock('./AdminsRow', () => {
  return function MockAdminsRow() {
    return <tr><td>Mock Admins Row</td></tr>;
  };
});

jest.mock('@/features/settings/api/admins/get-system-admins');

describe('AdminsTable', () => {

  const mockData = {
    admins: [
      {
        id: '0499945a-5bb1-4a13-9850-f8424654d003',
        name: 'Doe, Alex [USA]',
        email: 'doe_alex@domain.com',
      },
      {
        id: '50796284-970c-4c1c-bd07-02b981844a78',
        name: 'Doe, John [USA]',
        email: 'doe_john@domain.com',
      },
      {
        id: 'acff53b2-5fb6-4d39-b2e2-b2394fd344e4',
        name: 'Doe, Jane [USA]',
        email: null,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemAdmins as jest.Mock).mockReturnValue({
      data: mockData,
      isPending: false,
      error: null,
    });
  });

  it('renders table headers', () => {
    render(<AdminsTable />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders note about SSO admin privileges', () => {
    render(<AdminsTable />);

    expect(screen.getByText(/Note: Does not include/)).toBeInTheDocument();
  });

  it('renders a row for each admin', () => {
    render(<AdminsTable />);

    expect(screen.getAllByText('Mock Admins Row')).toHaveLength(mockData.admins.length);
  });

  it('renders loading text if admins are pending', () => {
    (useGetSystemAdmins as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: true,
      error: null,
    });

    render(<AdminsTable />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('admins-table')).not.toBeInTheDocument();
  });

  it('renders error message if admins failed to load', () => {
    (useGetSystemAdmins as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error('Failed to load admins'),
    });

    render(<AdminsTable />);

    expect(screen.getByText('Failed to load admins')).toBeInTheDocument();
    expect(screen.queryByTestId('admins-table')).not.toBeInTheDocument();
  });

  it('renders no admins found message if no admins are returned', () => {
    (useGetSystemAdmins as jest.Mock).mockReturnValue({
      data: { admins: [] },
      isPending: false,
      error: null,
    });

    render(<AdminsTable />);

    expect(screen.getByText('No admins found in DB.')).toBeInTheDocument();
    expect(screen.queryByTestId('admins-table')).not.toBeInTheDocument();
  });

  it('does not display pagination if admins.length < membersPerPage', () => {
    render(<AdminsTable />);

    expect(screen.queryByTestId('admins-pagination')).not.toBeInTheDocument();
  });

  it('displays pagination if admins.length > membersPerPage', () => {
    (useGetSystemAdmins as jest.Mock).mockReturnValueOnce({
      data: { admins: new Array(ITEMS_PER_PAGE + 1).map((_value, index) => ({ id: index })) },
      isPending: false,
      error: null,
    });

    render(<AdminsTable />);

    expect(screen.getByTestId('admins-pagination')).toBeInTheDocument();
  });
});
