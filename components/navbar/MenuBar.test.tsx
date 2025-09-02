import MenuBar from '@/components/navbar/MenuBar';
import ProfileProvider from '@/providers/ProfileProvider';
import { useRouter } from 'next/router';
import { renderWrapper } from '@/test/test-utils';
import { useSession } from 'next-auth/react';
import { UserSessionContext } from '@/components/layouts/AuthWrap';
import useGetIsUserGroupLead from '@/features/shared/api/get-is-user-group-lead';
import useGetChats from '@/features/chat/api/get-chats';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/features/shared/api/get-is-user-group-lead');
jest.mock('@/components/navbar/NavigationLinks.tsx', () => {
  return jest.fn().mockReturnValue(<div>Navigation Links</div>);
});

jest.mock('@/features/chat/api/get-chats', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const sessionRoleAdmin = {
  data: {
    user: {
      role: 'Admin',
    },
  },
};

const sessionRoleUser = {
  data: {
    user: {
      role: 'User',
    },
  },
};

const mockUserSession = {
  user: {
    name: 'Test Name',
    email: 'Test_Name@domain.com',
    image: '/',
  },
  expires: '2024-05-10T12:00:00.000Z',
};

describe('Describe the Side Menu Bar', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      pathname: '/',
      asPath: {
        startsWith: jest.fn().mockImplementation(() => true),
      },
    });

    (useGetChats as jest.Mock).mockReturnValue({
      data: {
        chats: [
          {
            id: '1',
            createdAt: '2025-05-13T12:00:00.000Z',
            updatedAt: '2025-05-13T12:05:00.000Z',
            summary: 'Test Message Summary',
            promptId: '1234',
          },
          {
            id: '2',
            createdAt: '2025-05-13T12:06:00.000Z',
            updatedAt: '2025-05-13T12:10:00.000Z',
            summary: 'Another Test Message Summary',
            promptId: '5678',
          },
        ],
      },
      isPending: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the menu options', () => {
    (useSession as jest.Mock).mockReturnValue(sessionRoleUser);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: false } });

    const { getByText, queryByText } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(queryByText('Settings')).not.toBeInTheDocument();
    expect(getByText('Navigation Links')).toBeInTheDocument();
  });

  it('should render UserProfileLink properties', () => {
    (useSession as jest.Mock).mockReturnValue(sessionRoleUser);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: true } });
    const { getByText } = renderWrapper(
      <UserSessionContext.Provider value={mockUserSession}>
        <ProfileProvider>
          <MenuBar />
        </ProfileProvider>
      </UserSessionContext.Provider>
    );

    const userProfileName = getByText('Test Name');
    const userProfileEmail = getByText('Test_Name@domain.com');
    expect(userProfileName).toBeInTheDocument();
    expect(userProfileEmail).toBeInTheDocument();
  });

  it('should show the SettingsNavLink if the user is an Admin', () => {
    (useSession as jest.Mock).mockReturnValue(sessionRoleAdmin);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: true } });
    const { getByText } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(getByText('Settings')).toBeInTheDocument();
  });

  it('should show the SettingsNavLink if the user is a group lead', () => {
    (useSession as jest.Mock).mockReturnValue(sessionRoleUser);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: true } });

    const { getByText } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(getByText('Settings')).toBeInTheDocument();
  });

  it('should show the AnalyticsNavLink if the user is an Admin', () => {
    (useSession as jest.Mock).mockReturnValueOnce(sessionRoleAdmin);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: false } });

    const { queryByText } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(queryByText('Analytics')).toBeInTheDocument();
  });

  it('should not show the AnalyticsNavLink if the user is not an Admin', () => {
    (useSession as jest.Mock).mockReturnValueOnce(sessionRoleUser);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: true } });

    const { queryByText } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(queryByText('Analytics')).not.toBeInTheDocument();
  });
});
