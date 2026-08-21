import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import { SafeExitProvider } from '@/features/shared/utils/SafeExitContext';
import NavLinkItem from './NavLinkItem';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

const mockRouter = {
  asPath: '/test',
};

const useRouter = jest.fn(() => mockRouter);

describe('NavLinkItem', () => {
  const mockOpenModal = jest.fn();
  
  const TestWrapper = ({ children }: any) => {
    return (
      <MantineProvider>
        <SafeExitProvider value={{ openModal: mockOpenModal, setSafeExitFormToDirty: jest.fn() }}>
          {children}
        </SafeExitProvider>
      </MantineProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    require('next/router').useRouter.mockImplementation(useRouter);
  });

  it('renders expanded nav link with label and description', () => {
    render(
      <TestWrapper>
        <NavLinkItem
          href='/test'
          icon={<div>icon</div>}
          label='Test Label'
          description='Test Description'
          testId='nav-link-test'
        />
      </TestWrapper>
    );

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-test')).toBeInTheDocument();
  });

  it('renders collapsed nav link with tooltip', () => {
    render(
      <TestWrapper>
        <NavLinkItem
          href='/test'
          icon={<div>icon</div>}
          label='Test Label'
          isCollapsed={true}
          testId='nav-link-collapsed'
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('nav-link-collapsed')).toBeInTheDocument();
  });

  it('marks link as active when router path starts with href', () => {
    mockRouter.asPath = '/test/subpath';
    
    render(
      <TestWrapper>
        <NavLinkItem
          href='/test'
          icon={<div>icon</div>}
          label='Test Label'
          testId='nav-link-active'
        />
      </TestWrapper>
    );

    const navLink = screen.getByTestId('nav-link-active');
    expect(navLink).toBeInTheDocument();
  });

  it('does not mark link as active when router path does not start with href', () => {
    mockRouter.asPath = '/other';
    
    render(
      <TestWrapper>
        <NavLinkItem
          href='/test'
          icon={<div>icon</div>}
          label='Test Label'
          testId='nav-link-inactive'
        />
      </TestWrapper>
    );

    const navLink = screen.getByTestId('nav-link-inactive');
    expect(navLink).toBeInTheDocument();
  });

  it('renders without description when not provided', () => {
    render(
      <TestWrapper>
        <NavLinkItem
          href='/test'
          icon={<div>icon</div>}
          label='Test Label'
          testId='nav-link-no-desc'
        />
      </TestWrapper>
    );

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
  });
});
