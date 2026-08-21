import { render, screen } from '@testing-library/react';

import Result from './Result';
import {
  RequirementStatus,
  ComplianceStatus,
} from '@/features/ai-agents/types/certa/webPolicyCompliance';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('Result', () => {
  const mockResult = {
    complianceStatus: ComplianceStatus.Yes,
    summarizedPolicy: 'Policy 1',
    overallExplanation: 'This is compliant',
    summary: 'This is a summary',
    requirements: [
      {
        explanation: 'Meets requirement',
        requirement: 'Requirement 1',
        status: RequirementStatus.Met,
        evidence: [{ text: 'Evidence 1', location: 'Location 1' }],
      },
    ],
  };

  it('should render with results', () => {
    render(<Result isLoading={false} result={mockResult} />);

    const sectionTitle = screen.getByText('Compliance Result');
    expect(sectionTitle).toBeInTheDocument();
  });

  it('does not render without results and not loading', () => {
    const { container } = render(
      <Result isLoading={false} result={undefined} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows loading state if results are loading', () => {
    render(<Result isLoading={true} result={undefined} />);

    const skeletons = document.querySelectorAll('.mantine-Skeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays requirements when provided', () => {
    render(<Result isLoading={false} result={mockResult} />);

    expect(screen.getByText('Requirements:')).toBeInTheDocument();
    expect(screen.getByText('Requirement 1')).toBeInTheDocument();
    expect(screen.getByText('Status: Met')).toBeInTheDocument();
    expect(screen.getByText('Analysis: Meets requirement')).toBeInTheDocument();
  });

  it('displays remediation steps when requirements are not fully met', () => {
    const resultWithRemediation = {
      complianceStatus: ComplianceStatus.VeryUnclear,
      summarizedPolicy: 'Policy 1',
      overallExplanation: 'This is not compliant',
      summary: 'This is a summary',
      requirements: [
        {
          explanation: 'Does not meet requirement',
          requirement: 'Requirement 1',
          status: RequirementStatus.NotMet,
          evidence: [{ text: 'Evidence 1', location: 'Location 1' }],
        },
      ],
      remediationSteps: ['Fix this issue'],
    };

    render(
      <Result
        isLoading={false}
        result={resultWithRemediation}
      />
    );

    expect(screen.getByText('Remediation Steps:')).toBeInTheDocument();
    expect(screen.getByText('1. Fix this issue')).toBeInTheDocument();
  });
});
