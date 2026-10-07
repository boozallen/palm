import { fireEvent, render } from '@testing-library/react';
import UserGroups from './UserGroups';
import { useDisclosure } from '@mantine/hooks';
import { SessionProvider } from 'next-auth/react';
import { UserRole } from '@/features/shared/types/user';

jest.mock(
  '@/features/settings/components/user-groups/modals/AddUserGroupModal',
  () => {
    return function MockedAddUserGroupModal() {
      return <div>Mocked Modal</div>;
    };
  }
);
jest.mock('@mantine/hooks');

jest.mock(
  '@/features/settings/components/user-groups/tables/UserGroupsAsAdminTable',
  () => {
    return function MockedUserGroupsTable() {
      return <div>User Groups As Admin Table Component</div>;
    };
  }
);

jest.mock(
  '@/features/settings/components/user-groups/tables/UserGroupsAsLeadTable',
  () => {
    return function MockedUserGroupsAsLeadTable() {
      return <div>User Groups As Lead Table Component</div>;
    };
  }
);

const renderComponent = (role: UserRole) => {
  const session = {
    expires: '1',
    user: {
      role: role,
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc158',
    },
    id: '6b54ffcd-c884-45c9-aa6e-57347f4cc158',
  };

  return render(
    <SessionProvider session={{ ...session, user: { ...session.user } }}>
      <UserGroups />
    </SessionProvider>
  );
};

describe('UserGroups', () => {
  const openMock = jest.fn();
  const closeMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: openMock, close: closeMock },
    ]);
  });

  it('renders without failure', () => {
    const { container } = renderComponent(UserRole.User);

    expect(container).toBeTruthy();
  });

  it('renders user group text', () => {
    const { getByText } = renderComponent(UserRole.User);

    expect(getByText('User Groups')).toBeInTheDocument();
  });

  it('renders add user group modal if user is Admin', () => {
    const { getByText } = renderComponent(UserRole.Admin);

    expect(getByText('Mocked Modal')).toBeInTheDocument();
  });

  it('does NOT render add user group modal if user is NOT Admin', () => {
    const { queryByText } = renderComponent(UserRole.User);

    expect(queryByText('Mocked Modal')).not.toBeInTheDocument();
  });

  it('renders add user group button if user is Admin', () => {
    const { getByTestId } = renderComponent(UserRole.Admin);

    expect(getByTestId('create-user-group-button')).toBeInTheDocument();
  });

  it('does NOT render add user group button if user is NOT Admin', () => {
    const { queryByTestId } = renderComponent(UserRole.User);

    expect(queryByTestId('add-user-group-button')).not.toBeInTheDocument();
  });

  it('opens modal when action icon is clicked', () => {
    const { getByTestId } = renderComponent(UserRole.Admin);

    const actionIcon = getByTestId('create-user-group-button');
    fireEvent.click(actionIcon);

    expect(openMock).toBeCalled();
  });

  it('renders UserGroupsAsAdminTable if user is Admin', () => {
    const { getByText, queryByText } = renderComponent(UserRole.Admin);

    expect(getByText('User Groups As Admin Table Component')).toBeInTheDocument();
    expect(queryByText('User Groups As Lead Table Component')).not.toBeInTheDocument();
  });

  it('renders UserGroupsAsLeadTable if user is NOT Admin', () => {
    const { getByText, queryByText } = renderComponent(UserRole.User);

    expect(queryByText('User Groups As Admin Table Component')).not.toBeInTheDocument();
    expect(getByText('User Groups As Lead Table Component')).toBeInTheDocument();
  });

});
