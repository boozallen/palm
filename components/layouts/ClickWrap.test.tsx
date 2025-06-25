import { fireEvent, render, waitFor } from '@testing-library/react';
import Clickwrap from '@/components/layouts/ClickWrap';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useCookies } from 'react-cookie';
import { useRouter } from 'next/router';
import AppHead from '@/components/layouts/AppHead';

jest.mock('@/features/shared/api/get-system-config');
jest.mock('react-cookie', () => ({
  useCookies: jest.fn(),
}));
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('next/head', () => {
  const Head = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
  };
  Head.displayName = 'Head';
  return Head;
});
jest.mock('@/components/layouts/AppHead', () => {
  return jest.fn(() => null);
});

describe('Clickwrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        termsOfUseBody: 'Test terms of use body.',
        termsOfUseHeader: 'Test terms of use header',
        termsOfUseCheckboxLabel: 'Test checkbox label',
      },
    });

    (useCookies as jest.Mock).mockReturnValue([
      { 'policy-acknowledged': '', setCookie: jest.fn(), removeCookie: jest.fn() },
      () => { },
    ]);

    (useRouter as jest.Mock).mockReturnValue({
      pathname: '/test-path',
    });
  });

  it('should render terms of use body', () => {
    const { getByText } = render(<Clickwrap><></></Clickwrap>);
    expect(getByText('Test terms of use body.')).toBeInTheDocument();
  });

  it('should not display error when checkbox is checked and continue button is clicked', async () => {
    const { queryByText, getByLabelText, getByText } = render(<Clickwrap><></></Clickwrap>);
    const checkbox = getByLabelText('Test checkbox label');
    fireEvent.click(checkbox);
    const continueButton = getByText('Continue');
    fireEvent.click(continueButton);
    await waitFor(() => {
      expect(queryByText('You must agree to the terms before proceeding')).not.toBeInTheDocument();
    });
  });

  it('should render children when terms of use body matches cookie', () => {
    (useCookies as jest.Mock).mockReturnValue([
      { 'policy-acknowledged': 'Test terms of use body.' },
      () => { },
    ]);
    const { getByText } = render(<Clickwrap>Test Child</Clickwrap>);
    expect(getByText('Test Child')).toBeInTheDocument();
  });

  it('should render the AppHead component', () => {
    render(<Clickwrap><></></Clickwrap>);
    expect(AppHead).toHaveBeenCalled();
  });
});
