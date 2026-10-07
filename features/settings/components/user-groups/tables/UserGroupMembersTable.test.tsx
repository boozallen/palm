import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserGroupMembersTable from './UserGroupMembersTable';
import useGetUserGroupMemberships from '@/features/settings/api/user-groups/get-user-group-memberships';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import { UserGroupRole } from '@/features/shared/types/user-group';

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

jest.mock('@/features/settings/api/user-groups/get-user-group-memberships');

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

const mockUserGroupMonthlyBudget = jest.fn();
jest.mock('@/features/settings/components/user-groups/elements/UserGroupMonthlyBudget', () => {
  return jest.fn(({ id, currentMonthlyBudget, totalSpend, monthlySpend, totalTokens, monthlyTokens }) => {
    mockUserGroupMonthlyBudget({ id, currentMonthlyBudget, totalSpend, monthlySpend, totalTokens, monthlyTokens });
    return (
      <div data-testid='user-group-monthly-budget'>
        <div>User Group Monthly Budget</div>
        <div data-testid='monthly-budget-id'>{id}</div>
        <div data-testid='monthly-budget-value'>{currentMonthlyBudget}</div>
        <div data-testid='monthly-budget-total-spend'>{totalSpend}</div>
        <div data-testid='monthly-budget-monthly-spend'>{monthlySpend}</div>
        <div data-testid='monthly-budget-total-tokens'>{totalTokens}</div>
        <div data-testid='monthly-budget-monthly-tokens'>{monthlyTokens}</div>
      </div>
    );
  });
});

describe('UserGroupMembersTable', () => {

  const mockUserGroupMembers = {
    userGroupMemberships: [
      {
        id: 'test-id-1',
        userId: 'user-1',
        userName: 'John Doe',
        email: 'john.doe@example.com',
        role: UserGroupRole.User,
        label: 'User Group Member 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: null,
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

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

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

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

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

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

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

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

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
    
    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

    const component = screen.getByText('User Group Join Code');
    expect(component).toBeInTheDocument();
  });

  it('passes correct props to UserGroupJoinCode component', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

    expect(mockUserGroupJoinCode).toHaveBeenCalledWith({
      id: mockUserGroupId,
      currentJoinCode: mockJoinCode,
    });

    const joinCodeId = screen.getByTestId('join-code-id');
    const joinCodeValue = screen.getByTestId('join-code-value');

    expect(joinCodeId).toHaveTextContent(mockUserGroupId);
    expect(joinCodeValue).toHaveTextContent(mockJoinCode);
  });

  it('passes correct props to UserGroupMonthlyBudget component', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={500} />);

    expect(mockUserGroupMonthlyBudget).toHaveBeenCalledWith({
      id: mockUserGroupId,
      currentMonthlyBudget: 500,
      totalSpend: 0,
      monthlySpend: 0,
      totalTokens: 0,
      monthlyTokens: 0,
    });

    const monthlyBudgetId = screen.getByTestId('monthly-budget-id');
    const monthlyBudgetValue = screen.getByTestId('monthly-budget-value');

    expect(monthlyBudgetId).toHaveTextContent(mockUserGroupId);
    expect(monthlyBudgetValue).toHaveTextContent('500');
  });

  it('sums member cost, monthlyCost, and token counts across the group for the spend rollup', () => {
    const mockUserGroupMembersWithSpend = {
      userGroupMemberships: [
        {
          id: 'test-id-1',
          userId: 'user-1',
          role: UserGroupRole.User,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
          cost: 10.5,
          monthlyCost: 2.5,
          inputTokens: 1000,
          outputTokens: 500,
          monthlyInputTokens: 100,
          monthlyOutputTokens: 50,
        },
        {
          id: 'test-id-2',
          userId: 'user-2',
          role: UserGroupRole.User,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
          cost: 5.25,
          monthlyCost: 1.75,
          inputTokens: 200,
          outputTokens: 300,
          monthlyInputTokens: 20,
          monthlyOutputTokens: 30,
        },
      ],
    };

    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembersWithSpend,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={500} />);

    expect(mockUserGroupMonthlyBudget).toHaveBeenCalledWith({
      id: mockUserGroupId,
      currentMonthlyBudget: 500,
      totalSpend: 15.75,
      monthlySpend: 4.25,
      totalTokens: 2000,
      monthlyTokens: 200,
    });
  });

  it('passes null joinCode to UserGroupJoinCode when joinCode is not provided', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={null} monthlyBudget={null} />);

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

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

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

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

    const pagination = screen.queryByTestId('pagination');
    expect(pagination).not.toBeInTheDocument();
  });

  it('renders search bar when there are members', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

    const searchBar = screen.getByPlaceholderText('Search members');
    expect(searchBar).toBeInTheDocument();
  });

  it('does not render search bar when there are no members', () => {
    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: { userGroupMemberships: [] },
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

    const searchBar = screen.queryByPlaceholderText('Search members');
    expect(searchBar).not.toBeInTheDocument();
  });

  it('filters members by name when searching', async () => {
    const mockUserGroupMembers = {
      userGroupMemberships: [
        {
          id: 'test-id-1',
          userId: 'user-1',
          userName: 'John Doe',
          email: 'john.doe@example.com',
          role: UserGroupRole.User,
          label: 'User Group Member 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
        {
          id: 'test-id-2',
          userId: 'user-2',
          userName: 'Jane Smith',
          email: 'jane.smith@example.com',
          role: UserGroupRole.User,
          label: 'User Group Member 2',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
      ],
    };

    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

    const searchBar = screen.getByPlaceholderText('Search members');
    await user.type(searchBar, 'John');

    await waitFor(() => {
      expect(screen.getByText(/Results for "John"/)).toBeInTheDocument();
      expect(screen.getByText(/1 member/)).toBeInTheDocument();
    }, { timeout: 600 });
  });

  it('filters members by email when searching', async () => {
    const mockUserGroupMembers = {
      userGroupMemberships: [
        {
          id: 'test-id-1',
          userId: 'user-1',
          userName: 'John Doe',
          email: 'john.doe@example.com',
          role: UserGroupRole.User,
          label: 'User Group Member 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
        {
          id: 'test-id-2',
          userId: 'user-2',
          userName: 'Jane Smith',
          email: 'jane.smith@example.com',
          role: UserGroupRole.User,
          label: 'User Group Member 2',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
      ],
    };

    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

    const searchBar = screen.getByPlaceholderText('Search members');
    await user.type(searchBar, 'jane.smith');

    await waitFor(() => {
      expect(screen.getByText(/Results for "jane.smith"/)).toBeInTheDocument();
      expect(screen.getByText(/1 member/)).toBeInTheDocument();
    }, { timeout: 600 });
  });

  it('displays no match message when search has no results', async () => {
    const mockUserGroupMembers = {
      userGroupMemberships: [
        {
          id: 'test-id-1',
          userId: 'user-1',
          userName: 'John Doe',
          email: 'john.doe@example.com',
          role: UserGroupRole.User,
          label: 'User Group Member 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
      ],
    };

    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

    const searchBar = screen.getByPlaceholderText('Search members');
    await user.type(searchBar, 'NonExistentUser');

    await waitFor(() => {
      expect(screen.getByText('No members match your search.')).toBeInTheDocument();
    }, { timeout: 600 });
  });

  it('displays total member count when search is empty', () => {
    const mockUserGroupMembers = {
      userGroupMemberships: [
        {
          id: 'test-id-1',
          userId: 'user-1',
          userName: 'John Doe',
          email: 'john.doe@example.com',
          role: UserGroupRole.User,
          label: 'User Group Member 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
        {
          id: 'test-id-2',
          userId: 'user-2',
          userName: 'Jane Smith',
          email: 'jane.smith@example.com',
          role: UserGroupRole.User,
          label: 'User Group Member 2',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
      ],
    };

    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

    expect(screen.getByText(/Results:/)).toBeInTheDocument();
    expect(screen.getByText(/2 members/)).toBeInTheDocument();
  });

  it('handles members with undefined userName or email gracefully when searching', async () => {
    const mockUserGroupMembers = {
      userGroupMemberships: [
        {
          id: 'test-id-1',
          userId: 'user-1',
          userName: undefined,
          email: 'john.doe@example.com',
          role: UserGroupRole.User,
          label: 'User Group Member 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
        {
          id: 'test-id-2',
          userId: 'user-2',
          userName: 'Jane Smith',
          email: undefined,
          role: UserGroupRole.User,
          label: 'User Group Member 2',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
        {
          id: 'test-id-3',
          userId: 'user-3',
          userName: 'Bob Johnson',
          email: 'bob.johnson@example.com',
          role: UserGroupRole.User,
          label: 'User Group Member 3',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
      ],
    };

    (useGetUserGroupMemberships as jest.Mock).mockReturnValue({
      data: mockUserGroupMembers,
      isPending: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<UserGroupMembersTable id={mockUserGroupId} joinCode={mockJoinCode} monthlyBudget={null} />);

    const searchBar = screen.getByPlaceholderText('Search members');
    await user.type(searchBar, 'john.doe');

    await waitFor(() => {
      expect(screen.getByText(/Results for "john.doe"/)).toBeInTheDocument();
      expect(screen.getByText(/1 member/)).toBeInTheDocument();
    }, { timeout: 600 });
  });

});
