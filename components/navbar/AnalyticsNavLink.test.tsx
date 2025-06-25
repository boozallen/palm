import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';

import AnalyticsNavLink from './AnalyticsNavLink';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('AnalyticsNavLink', () => {
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

  it('should render analytics text', () => {
    render(<AnalyticsNavLink />);
    expect(screen.queryByText('Analytics')).toBeInTheDocument();
  });
});
