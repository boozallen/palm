import { screen } from '@testing-library/react';
import { useRouter } from 'next/router';

import DisplayProfile from '@/pages/profile';
import { renderWrapper } from '@/test/test-utils';
import ProfileProvider from '@/providers/ProfileProvider';
import { UserGroupAttributionProvider } from '@/features/shared/providers/UserGroupAttribution/UserGroupAttributionProvider';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useGetBedrockModelAccess } from '@/features/shared/api/get-bedrock-model-access';
import useGetUserGroups from '@/features/profile/api/get-user-groups';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetEmbeddingEligibleAiProviders from '@/features/shared/api/document-upload/get-embedding-eligible-ai-providers';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/get-bedrock-model-access');
jest.mock('@/features/profile/api/get-user-groups');
jest.mock('@/features/shared/api/get-available-models');
jest.mock('@/features/shared/api/document-upload/get-embedding-eligible-ai-providers');
jest.mock('@/features/profile/components/user-groups/UserGroups', () => {
  return jest.fn(() => <div>User Groups Panel</div>);
});

jest.mock('@/features/shared/components/JoinUserGroupCallout/JoinUserGroupCalloutProvider', () => ({
  useJoinUserGroupCallout: () => ({
    setBlockingModalOpen: jest.fn(),
  }),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        role: 'User',
      },
    },
  }),
}));

jest.mock('@/features/profile/components/UserBanner', () => {
  return {
    UserBanner: function UserBanner() {
      return <div>User Banner</div>;
    },
  };
});

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: jest.fn().mockReturnValue({ mutate: jest.fn() }),
}));

describe('DisplayProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      query: {},
      pathname: '/profile',
      replace: jest.fn(),
    });

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: 'some-provider-1',
      },
      isPending: false,
    });

    (useGetBedrockModelAccess as jest.Mock).mockReturnValue({
      data: {
        hasAccess: true,
      },
      isPending: false,
    });

    (useGetUserGroups as jest.Mock).mockReturnValue({ data: { userGroups: [] } });
    (useGetAvailableModels as jest.Mock).mockReturnValue({ data: { availableModels: [] } });
    (useGetEmbeddingEligibleAiProviders as jest.Mock).mockReturnValue({ data: { aiProviderIds: [] } });
  });

  it('displays the profile title and user banner', () => {
    const { getByText } = renderWrapper(
      <UserGroupAttributionProvider>
        <ProfileProvider>
          <DisplayProfile />
        </ProfileProvider>
      </UserGroupAttributionProvider>
    );

    expect(getByText('Profile')).toBeInTheDocument();
    expect(getByText('User Banner')).toBeInTheDocument();
  });

  it('renders the correct tabs', () => {
    renderWrapper(
      <UserGroupAttributionProvider>
        <ProfileProvider>
          <DisplayProfile />
        </ProfileProvider>
      </UserGroupAttributionProvider>
    );

    expect(screen.getByText('Knowledge Bases')).toBeInTheDocument();
    expect(screen.getByText('User Groups')).toBeInTheDocument();
  });

  it('does not render document library tab when System Config documentLibraryDocumentUploadProviderId is null', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: undefined,
      },
      isPending: false,
    });

    (useGetBedrockModelAccess as jest.Mock).mockReturnValue({
      data: {
        hasAccess: true,
      },
      isPending: false,
    });

    renderWrapper(
      <UserGroupAttributionProvider>
        <ProfileProvider>
          <DisplayProfile />
        </ProfileProvider>
      </UserGroupAttributionProvider>
    );

    expect(screen.queryByText('Document Library')).not.toBeInTheDocument();
  });
});
