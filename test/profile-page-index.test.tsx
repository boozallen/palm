import DisplayProfile from '@/pages/profile';
import { renderWrapper } from '@/test/test-utils';
import ProfileProvider from '@/providers/ProfileProvider';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { features } from '@/libs/featureFlags';
import { screen } from '@testing-library/react';
import { useRouter } from 'next/router';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/api/get-feature-flag');
jest.mock('@/features/profile/components/user-groups/UserGroups', () => {
  return jest.fn(() => <div>User Groups Panel</div>);
});

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

describe('DisplayProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      query: {},
      pathname: '/profile',
      replace: jest.fn(),
    });

    (useGetFeatureFlag as jest.Mock).mockImplementation(({ feature }) => {
      if (feature === features.DOCUMENT_LIBRARY) {
        return { data: { isFeatureOn: true } };
      }
      return { data: { isFeatureOn: false } };
    });
  });

  it('displays the profile title and user banner', () => {
    const { getByText } = renderWrapper(
      <ProfileProvider>
        <DisplayProfile />
      </ProfileProvider>
    );

    expect(getByText('Profile')).toBeInTheDocument();
    expect(getByText('User Banner')).toBeInTheDocument();
  });

  it('renders the correct tabs', () => {
    renderWrapper(
      <ProfileProvider>
        <DisplayProfile />
      </ProfileProvider>
    );

    expect(screen.getByText('Knowledge Bases')).toBeInTheDocument();
    expect(screen.getByText('User Groups')).toBeInTheDocument();
  });

  it('does not render document library tab if feature flag is off', () => {
    (useGetFeatureFlag as jest.Mock).mockImplementation(({ feature }) => {
      if (feature === features.DOCUMENT_LIBRARY) {
        return { data: { isFeatureOn: false } };
      } else {
        return { data: { isFeatureOn: true } };
      }
    });

    renderWrapper(
      <ProfileProvider>
        <DisplayProfile />
      </ProfileProvider>
    );

    expect(screen.queryByText('Document Library')).not.toBeInTheDocument();
  });
});
