import { render, screen } from '@testing-library/react';
import { Accordion } from '@mantine/core';
import Policy from '@/features/legal/components/restricted-rights/Policy';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

jest.mock('@/features/shared/api/get-system-config');

const AccordionWrapper = ({ children }: { children: React.ReactNode }) => (
  <Accordion>{children}</Accordion>
);

describe('Policy Component', () => {
  const systemConfig = {
    legalPolicyHeader: 'Legal Header',
    legalPolicyBody: 'Legal Body',
  };

  const renderPolicy = () => {
    render(
      <AccordionWrapper>
        <Policy />
      </AccordionWrapper>
    );
  };

  it('renders Loading when system config is pending', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    render(<Policy />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders error text when system config returns an error', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      error: new Error('Failed to load'),
    });

    render(<Policy />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('renders system configuration', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: systemConfig,
      isPending: false,
      error: null,
    });
    renderPolicy();

    expect(screen.getByText(systemConfig.legalPolicyHeader)).toBeInTheDocument();
    expect(screen.getByText(systemConfig.legalPolicyBody)).toBeInTheDocument();
  });
});
