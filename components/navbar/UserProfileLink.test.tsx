import { useRouter } from 'next/router';
import UserProfileLink from '@/components/navbar/UserProfileLink';
import { renderWrapper } from '@/test/test-utils';
import { UserSessionContext } from '@/components/layouts/AuthWrap';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('UserProfileLink', () => {

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      pathname: '/',
      asPath: {
        startsWith: jest.fn().mockImplementation(() => true),
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockUserSession = {
    user: {
      name: 'Test Name',
      email: 'Test_Name@domain.com',
      image: '/',
    },
    expires: '2024-05-10T12:00:00.000Z',
  };

  it('should render UserProfileLink properties', () => {
    const { getAllByTestId, getByText } = renderWrapper(
      <UserSessionContext.Provider value={mockUserSession}>
        <UserProfileLink />
      </UserSessionContext.Provider>
    );

    const userProfileName = getByText('Test Name');
    const userProfileEmail = getByText('Test_Name@domain.com');
    expect(userProfileName).toBeInTheDocument();
    expect(userProfileEmail).toBeInTheDocument();

    const safeExit = getAllByTestId('safeExit');
    expect(safeExit[0]).toBeInTheDocument();
  });

});

