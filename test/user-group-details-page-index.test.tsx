import { useRouter } from 'next/router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import useGetUserGroup from '@/features/settings/api/get-user-group';
import UserGroupDetailsPage from '@/pages/settings/user-groups/[id]';

jest.mock('@/features/settings/api/get-user-group');

jest.mock(
  '@/features/settings/components/user-groups/tables/UserGroupMembersTable',
  () => {
    return function UserGroupsMembersTable() {
      return <div>User Group Members Table</div>;
    };
  }
);

jest.mock(
  '@/features/settings/components/user-groups/tables/UserGroupAiProvidersTable',
  () => {
    return function UserGroupsAiProvidersTable() {
      return <div>User Group AI Providers Table</div>;
    };
  }
);

jest.mock(
  '@/features/settings/components/user-groups/tables/UserGroupKbProvidersTable',
  () => {
    return function UserGroupsKbProvidersTable() {
      return <div>User Group KB Providers Table</div>;
    };
  }
);

jest.mock(
  '@/features/settings/components/user-groups/tables/UserGroupAiAgentsTable',
  () => {
    return function UserGroupsAiAgentsTable() {
      return <div>User Group AI Agents Table</div>;
    };
  }
);

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('UserGroupDetailsPage', () => {
  const mockUserGroupId = '60c410be-11b0-4b78-ad85-dceeeb0701cd';
  const mockJoinCode = '12345678';

  const mockRouter = {
    query: {
      id: mockUserGroupId,
    },
  };

  const mockUserGroup = {
    id: mockUserGroupId,
    label: 'Mock User Group',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 5,
    joinCode: mockJoinCode,
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    (useGetUserGroup as jest.Mock).mockReturnValue({
      data: mockUserGroup,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it('renders user group details page title', () => {
    render(<UserGroupDetailsPage />);

    const title = screen.getByText('User Group');
    const description = screen.getByText(
      `View and manage the resources and members assigned to ${mockUserGroup.label}`
    );

    expect(title).toBeInTheDocument();
    expect(description).toBeInTheDocument();
  });

  it('renders correct tabs', () => {
    render(<UserGroupDetailsPage />);
    const membersTab = screen.getByText('Members');
    const aiProvidersTab = screen.getByText('AI Providers');
    const kbProvidersTab = screen.getByText('Knowledge Base Providers');
    const agentsTab = screen.getByText('AI Agents');

    expect(membersTab).toBeInTheDocument();
    expect(aiProvidersTab).toBeInTheDocument();
    expect(kbProvidersTab).toBeInTheDocument();
    expect(agentsTab).toBeInTheDocument();
  });

  it('displays members tab and table by default', async () => {
    render(<UserGroupDetailsPage />);

    expect(screen.getByText('User Group Members Table')).toBeInTheDocument();
  });

  it('displays ai providers table when ai providers tab is selected', async () => {
    render(<UserGroupDetailsPage />);
    const aiProvidersTab = screen.getByText('AI Providers');

    expect(
      screen.queryByText('User Group AI Providers Table')
    ).not.toBeInTheDocument();

    fireEvent.click(aiProvidersTab);

    await waitFor(() => {
      expect(
        screen.getByText('User Group AI Providers Table')
      ).toBeInTheDocument();
    });
  });

  it('displays kb providers table when kb providers tab is selected', async () => {
    render(<UserGroupDetailsPage />);
    const kbProvidersTab = screen.getByText('Knowledge Base Providers');

    expect(
      screen.queryByText('User Group KB Providers Table')
    ).not.toBeInTheDocument();

    fireEvent.click(kbProvidersTab);

    await waitFor(() => {
      expect(
        screen.getByText('User Group KB Providers Table')
      ).toBeInTheDocument();
    });
  });

  it('displays ai agents table when ai agents tab is selected', async () => {
    render(<UserGroupDetailsPage />);
    const aiAgentsTab = screen.getByText('AI Agents');

    expect(
      screen.queryByText('User Group AI Agents Table')
    ).not.toBeInTheDocument();

    fireEvent.click(aiAgentsTab);

    await waitFor(() => {
      expect(
        screen.getByText('User Group AI Agents Table')
      ).toBeInTheDocument();
    });
  });
});
