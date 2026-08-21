import { useRouter } from 'next/router';
import { fireEvent } from '@testing-library/react';
import { renderWrapper } from '@/test/test-utils';
import { useSession } from 'next-auth/react';

import { UserSessionContext } from '@/components/layouts/AuthWrap';
import { useCreateClientSideAuditRecord } from '@/features/shared/api/create-client-side-audit-record';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';
import useGetIsUserGroupLead from '@/features/shared/api/get-is-user-group-lead';
import { useGetUserContextStudioAccess } from '@/features/shared/api/get-user-context-studio-access';
import useGetChats from '@/features/chat/api/get-chats';
import MenuBar from '@/components/navbar/MenuBar';
import ProfileProvider from '@/providers/ProfileProvider';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/features/shared/api/get-is-user-group-lead');
jest.mock('@/features/shared/api/get-user-context-studio-access');
jest.mock('@/components/navbar/NavigationLinks.tsx', () => {
  return jest.fn().mockReturnValue(<div>Navigation Links</div>);
});

jest.mock('@/features/chat/api/get-chats', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

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

const mockCreateAuditRecord = jest.fn();

describe('Describe the Side Menu Bar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();

    // The global jest.setup mock swallows the audit mutation; override it here so
    // the collapse-toggle assertions can see what was recorded.
    (useCreateClientSideAuditRecord as jest.Mock).mockReturnValue({ mutate: mockCreateAuditRecord });

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
    (useGetUserContextStudioAccess as jest.Mock).mockReturnValue({ data: { hasAccess: false } });

    const { getByText, queryByTestId } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(queryByTestId('settings-nav-link')).not.toBeInTheDocument();
    expect(getByText('Navigation Links')).toBeInTheDocument();
  });

  it('should render UserProfileLink properties', () => {
    (useSession as jest.Mock).mockReturnValue(sessionRoleUser);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: true } });
    (useGetUserContextStudioAccess as jest.Mock).mockReturnValue({ data: { hasAccess: false } });
    const { getByTestId } = renderWrapper(
      <UserSessionContext.Provider value={mockUserSession}>
        <ProfileProvider>
          <MenuBar />
        </ProfileProvider>
      </UserSessionContext.Provider>
    );

    const userProfileLink = getByTestId('user-profile-link');
    const userProfileAvatar = getByTestId('user-profile-avatar');
    expect(userProfileLink).toBeInTheDocument();
    expect(userProfileAvatar).toBeInTheDocument();
    expect(userProfileAvatar).toHaveTextContent('T');
  });

  it('should show the SettingsNavLink if the user is an Admin', () => {
    (useSession as jest.Mock).mockReturnValue(sessionRoleAdmin);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: true } });
    (useGetUserContextStudioAccess as jest.Mock).mockReturnValue({ data: { hasAccess: false } });
    const { getByTestId } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(getByTestId('settings-nav-link')).toBeInTheDocument();
  });

  it('should show the SettingsNavLink if the user is a group lead', () => {
    (useSession as jest.Mock).mockReturnValue(sessionRoleUser);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: true } });
    (useGetUserContextStudioAccess as jest.Mock).mockReturnValue({ data: { hasAccess: false } });

    const { getByTestId } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(getByTestId('settings-nav-link')).toBeInTheDocument();
  });

  // The Analytics page is gone — its contents are the Context Studio Cost tab
  // now, reached through the existing Activity link.
  it.each([
    ['an Admin', sessionRoleAdmin],
    ['a non-Admin', sessionRoleUser],
  ])('should not show an AnalyticsNavLink for %s', (_label, session) => {
    (useSession as jest.Mock).mockReturnValue(session);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: false } });
    (useGetUserContextStudioAccess as jest.Mock).mockReturnValue({ data: { hasAccess: true } });

    const { queryByTestId } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(queryByTestId('analytics-nav-link')).not.toBeInTheDocument();
  });

  it('should show the ActivityNavLink if the user has access', () => {
    (useSession as jest.Mock).mockReturnValue(sessionRoleUser);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: false } });
    (useGetUserContextStudioAccess as jest.Mock).mockReturnValue({ data: { hasAccess: true } });

    const { getByTestId } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(getByTestId('context-studio-nav-link')).toBeInTheDocument();
  });

  it('should not show the ActivityNavLink if the user does not have access', () => {
    (useSession as jest.Mock).mockReturnValue(sessionRoleUser);
    (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: false } });
    (useGetUserContextStudioAccess as jest.Mock).mockReturnValue({ data: { hasAccess: false } });

    const { queryByTestId } = renderWrapper(
      <ProfileProvider>
        <MenuBar />
      </ProfileProvider>
    );

    expect(queryByTestId('context-studio-nav-link')).not.toBeInTheDocument();
  });

  describe('sidebar collapse audit record', () => {
    const renderMenuBar = () => {
      (useSession as jest.Mock).mockReturnValue(sessionRoleUser);
      (useGetIsUserGroupLead as jest.Mock).mockReturnValue({ data: { isUserGroupLead: false } });
      (useGetUserContextStudioAccess as jest.Mock).mockReturnValue({ data: { hasAccess: false } });

      return renderWrapper(
        <ProfileProvider>
          <MenuBar />
        </ProfileProvider>
      );
    };

    it('records collapsing the sidebar as a panel toggle', () => {
      const { getByTitle } = renderMenuBar();

      fireEvent.click(getByTitle('Collapse sidebar'));

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.TogglePanel,
        label: 'Collapse sidebar',
      });
    });

    // The label has to name the direction of the click, not the resulting state,
    // or the trail reads backwards.
    it('records expanding the sidebar when it was already collapsed', () => {
      const { getByTitle } = renderMenuBar();

      fireEvent.click(getByTitle('Collapse sidebar'));
      fireEvent.click(getByTitle('Expand sidebar'));

      expect(mockCreateAuditRecord).toHaveBeenLastCalledWith({
        event: AuditRecordEvent.TogglePanel,
        label: 'Expand sidebar',
      });
    });

    // A collapse changes nothing about the page the user is on, so it must not
    // be recorded as a navigation.
    it('does not record the collapse as a navigation', () => {
      const { getByTitle } = renderMenuBar();

      fireEvent.click(getByTitle('Collapse sidebar'));

      expect(mockCreateAuditRecord).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: AuditRecordEvent.Navigation }),
      );
    });
  });
});
