import { render, screen } from '@testing-library/react';
import UserGroupMembersTable from './UserGroupMembersTable';
import useGetUserGroupMemberships from '@/features/settings/api/get-user-group-memberships';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';

jest.mock('@/features/settings/components/user-groups/tables/UserGroupMembersTableHead', () => {
  return function MockedUserGroupMembersTableHead() {
    return <thead><tr><th>Mocked User Group Members Table Head</th></tr></thead>;
  };
});

jest.mock('@/features/settings/components/user-groups/tables/UserGroupMembersTableBody', () => {
  return function MockedUserGroupMembersTableBody() {
    return <tbody><tr><td>Mocked User Group Members Table Body</td></tr></tbody>;
  };
});

jest.mock('@/features/settings/api/get-user-group-memberships');

const mockUserGroupJoinCode = jest.fn();
jest.mock('@/features/settings/components/user-groups/elements/UserGroupJoinCode', () => {
  return jest.fn(({ id, currentJoinCode }) => {
    mockUserGroupJoinCode({ id, currentJoinCode });
    return (
      <div data-testid='user-group-join-code'>
        <div>User Group Join Code</div>
        <div data-testid='join-code-id'>{id}</div>
        <div data-testid='join-code-value'>{currentJoinCode}</div>
      </div>
    );
  });
});

describe('UserGroupMembersTable', () => {

  const mockUserGroupMembers = {
    userGroupMemberships: [
      {
        id: 'test-id-1',
        label: 'User Group Member 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  const mockUserGroupId = 'test-id-1';
  const mockJoinCode = '12345678';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValueOnce({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} />);

    const table = screen.getByTestId('user-group-members-table');
    const userGroupMembersTableHead = screen.getByText('Mocked User Group Members Table Head');
    const userGroupMembersTableBody = screen.getByText('Mocked User Group Members Table Body');

    expect(table).toBeInTheDocument();
    expect(userGroupMembersTableHead).toBeInTheDocument();
    expect(userGroupMembersTableBody).toBeInTheDocument();
  });

  it('does not render table if data is pending', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: { userGroupMemberships: [] },
      isPending: true,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} />);

    const table = screen.queryByTestId('user-group-members-table');
    const userGroupMembersTableHead = screen.queryByText('Mocked User Group Members Table Head');
    const userGroupMembersTableBody = screen.queryByText('Mocked User Group Members Table Body');
    const loading = screen.getByText('Loading...');

    expect(table).not.toBeInTheDocument();
    expect(userGroupMembersTableHead).not.toBeInTheDocument();
    expect(userGroupMembersTableBody).not.toBeInTheDocument();
    expect(loading).toBeInTheDocument();
  });

  it('renders error message if there is a problem fetching data', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: { userGroupMemberships: [] },
      isPending: false,
      error: new Error('Error fetching data'),
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} />);

    const table = screen.queryByTestId('user-group-members-table');
    const userGroupMembersTableHead = screen.queryByText('Mocked User Group Members Table Head');
    const userGroupMembersTableBody = screen.queryByText('Mocked User Group Members Table Body');
    const error = screen.getByText('Error fetching data');

    expect(table).not.toBeInTheDocument();
    expect(userGroupMembersTableHead).not.toBeInTheDocument();
    expect(userGroupMembersTableBody).not.toBeInTheDocument();
    expect(error).toBeInTheDocument();
  });

  it('renders a message if there are no user group members', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: { userGroupMemberships: [] },
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} />);

    const table = screen.queryByTestId('user-group-members-table');
    const userGroupMembersTableHead = screen.queryByText('Mocked User Group Members Table Head');
    const userGroupMembersTableBody = screen.queryByText('Mocked User Group Members Table Body');
    const message = screen.getByText('No members have been added yet.');

    expect(table).not.toBeInTheDocument();
    expect(userGroupMembersTableHead).not.toBeInTheDocument();
    expect(userGroupMembersTableBody).not.toBeInTheDocument();
    expect(message).toBeInTheDocument();
  });

  it('renders UserGroupJoinCode component', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isLoading: false,
      error: null,
    });
    
    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} />);

    const component = screen.getByText('User Group Join Code');
    expect(component).toBeInTheDocument();
  });

  it('passes correct props to UserGroupJoinCode component', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} />);

    expect(mockUserGroupJoinCode).toHaveBeenCalledWith({
      id: mockUserGroupId,
      currentJoinCode: mockJoinCode,
    });

    const joinCodeId = screen.getByTestId('join-code-id');
    const joinCodeValue = screen.getByTestId('join-code-value');

    expect(joinCodeId).toHaveTextContent(mockUserGroupId);
    expect(joinCodeValue).toHaveTextContent(mockJoinCode);
  });

  it('passes null joinCode to UserGroupJoinCode when joinCode is not provided', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={null} />);

    expect(mockUserGroupJoinCode).toHaveBeenCalledWith({
      id: mockUserGroupId,
      currentJoinCode: null,
    });
  });

  it('renders pagination and handles page change when there are more members than ITEMS_PER_PAGE', () => {
    const mockUserGroupMembers = {
      userGroupMemberships: Array.from({ length: ITEMS_PER_PAGE + 2 }, (_, i) => ({
        id: `test-id-${i + 1}`,
        label: `User Group Member ${i + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    };

    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} />);

    const pagination = screen.getByTestId('pagination');
    expect(pagination).toBeInTheDocument();
    const currentPage = screen.getByText('2');
    expect(currentPage).toBeInTheDocument();
  });

  it('does not render pagination when there are equal or fewer members than ITEMS_PER_PAGE', () => {
    const mockUserGroupMembers = {
      userGroupMemberships: Array.from({ length: ITEMS_PER_PAGE }, (_, i) => ({
        id: `test-id-${i + 1}`,
        label: `User Group Member ${i + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    };

    (useGetUserGroupMemberships as jest.Mock).mockReturnValueOnce({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} />);

    const pagination = screen.queryByTestId('pagination');
    expect(pagination).not.toBeInTheDocument();
  });

});
