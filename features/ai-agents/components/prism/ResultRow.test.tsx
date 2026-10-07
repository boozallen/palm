import { render, screen } from '@testing-library/react';

import ResultRow from './ResultRow';
import { ComplianceStatus } from '@/features/ai-agents/types/prism/complianceResult';
import type { ComplianceResult } from '@/features/ai-agents/types/prism/complianceResult';

const mockItem: ComplianceResult = {
  id: 'result-1',
  jobId: 'job-1',
  category: 'Technical',
  requirement: 'The system shall support 1,000 concurrent users.',
  complianceStatus: ComplianceStatus.YES,
  reasoning: 'The proposal clearly addresses this requirement.',
  citations: 'Our platform supports up to 5,000 concurrent users.',
  sortOrder: 0,
};

const container = document.body
  .appendChild(document.createElement('table'))
  .appendChild(document.createElement('tbody'));

describe('ResultRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the requirement text', () => {
    render(<ResultRow item={mockItem} showCitations={false} />, { container });

    expect(screen.getByText('The system shall support 1,000 concurrent users.')).toBeInTheDocument();
  });

  it('renders Yes badge for YES compliance status', () => {
    render(<ResultRow item={mockItem} showCitations={false} />, { container });

    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('renders No badge for NO compliance status', () => {
    render(
      <ResultRow item={{ ...mockItem, complianceStatus: ComplianceStatus.NO }} showCitations={false} />,
      { container },
    );

    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders N/A badge for NOT_APPLICABLE compliance status', () => {
    render(
      <ResultRow item={{ ...mockItem, complianceStatus: ComplianceStatus.NOT_APPLICABLE }} showCitations={false} />,
      { container },
    );

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders Needs Review badge for NEEDS_REVIEW compliance status', () => {
    render(
      <ResultRow item={{ ...mockItem, complianceStatus: ComplianceStatus.NEEDS_REVIEW }} showCitations={false} />,
      { container },
    );

    expect(screen.getByText('Needs Review')).toBeInTheDocument();
  });

  it('renders reasoning text', () => {
    render(<ResultRow item={mockItem} showCitations={false} />, { container });

    expect(screen.getByText('The proposal clearly addresses this requirement.')).toBeInTheDocument();
  });

  it('shows dash placeholder when citations are hidden', () => {
    render(<ResultRow item={mockItem} showCitations={false} />, { container });

    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.queryByText('Our platform supports up to 5,000 concurrent users.')).not.toBeInTheDocument();
  });

  it('shows citation text when citations are shown', () => {
    render(<ResultRow item={mockItem} showCitations={true} />, { container });

    expect(screen.getByText('Our platform supports up to 5,000 concurrent users.')).toBeInTheDocument();
  });

  it('shows No citation when citations are shown but null', () => {
    render(
      <ResultRow item={{ ...mockItem, citations: null }} showCitations={true} />,
      { container },
    );

    expect(screen.getByText('No citation')).toBeInTheDocument();
  });
});
