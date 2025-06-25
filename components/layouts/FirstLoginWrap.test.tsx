import { render } from '@testing-library/react';
import { useRouter } from 'next/router';
import { useContext } from 'react';
import { useCookies } from 'react-cookie';
import FirstLoginWrap from './FirstLoginWrap';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('react-cookie', () => ({
  useCookies: jest.fn(),
}));

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: jest.fn(),
}));

describe('FirstLoginWrap', () => {
  const mockPush = jest.fn();
  const mockSetCookie = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useCookies as jest.Mock).mockReturnValue([{}, mockSetCookie]);
    (useContext as jest.Mock).mockReturnValue({ user: { lastLoginAt: null } });
  });

  it('should set cookie and redirect on first login', () => {
    render(<FirstLoginWrap><div>Child Component</div></FirstLoginWrap>);

    expect(mockSetCookie).toHaveBeenCalledWith('first-login', 'true', { path: '/' });
    expect(mockPush).toHaveBeenCalledWith('/profile?first_login=true');
  });

  it('should not redirect if not first login', () => {
    (useContext as jest.Mock).mockReturnValue({ user: { lastLoginAt: '2023-01-01' } });

    render(<FirstLoginWrap><div>Child Component</div></FirstLoginWrap>);

    expect(mockSetCookie).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should render children', () => {
    const { getByText } = render(<FirstLoginWrap><div>Child Component</div></FirstLoginWrap>);

    expect(getByText('Child Component')).toBeInTheDocument();
  });
});
