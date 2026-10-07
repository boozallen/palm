import ProfileProvider, { useProfile } from './ProfileProvider';
import { renderWrapper } from '@/test/test-utils';

// Test suite was complaining because the useSession
// hook was called outside of the session provider.
// Solution found here: https://github.com/nextauthjs/next-auth/discussions/4185#discussioncomment-2397318
jest.mock('next-auth/react', () => {
  const originalModule = jest.requireActual('next-auth/react');
  const mockSession = {
    expires: new Date(Date.now() + 2 * 86400).toISOString(),
    user: { 
      username: 'admin',
      role: 'Admin',
    },
  };
  return {
    __esModule: true,
    ...originalModule,
    useSession: jest.fn(() => {
      return { data: mockSession, status: 'authenticated' };  // return type is [] in v3 but changed to {} in v4
    }),
  };
});

const FirstChildComponent = () => {
  const profile = useProfile();
  return (
    <div data-profile={profile}>
      One
    </div>
  );
};

const SecondChildComponent = () => {
  const profile = useProfile();
  return (
    <div data-profile={profile}>
      Two
    </div>
  );
};

describe('ProfileProvider', () => {
  it('provides expected ProfileProvider to child components', () => {
    const { getByText } = renderWrapper(
      <ProfileProvider>
        <FirstChildComponent/>
        <SecondChildComponent/>
      </ProfileProvider>
    );
    const firstChild = getByText('One');
    const secondChild = getByText('Two');
    const firstChildProfile = firstChild.getAttribute('data-profile');
    const secondChildProfile = secondChild.getAttribute('data-profile');
    expect(firstChildProfile).toBe(secondChildProfile);
  });
});

