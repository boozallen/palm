import SettingsNavLink from './SettingsNavLink';
import { useRouter } from 'next/router';
import { render } from '@testing-library/react';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('SettingsNavLink', () => {
  const mockRouter = {
    push: jest.fn(),
    asPath: {
      startsWith: jest.fn().mockImplementation(() => true),
    },
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render SettingsNavLink', () => {
    const { getByTestId } = render(
      <SettingsNavLink />
    );

    const settingsNavLink = getByTestId('settings-nav-link');
    expect(settingsNavLink).toBeInTheDocument();
  });
});
