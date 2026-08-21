import { render, screen } from '@testing-library/react';

import ChecklistTable from './ChecklistTable';
import { AnalysisStatus, AnalysisConfidence } from '@/features/ai-agents/types/swear/analysisItem';
import type { AnalysisItem } from '@/features/ai-agents/types/swear/analysisItem';

describe('ChecklistTable', () => {
  const mockItems: AnalysisItem[] = [
    {
      category: 'Preliminary Information',
      requirement: 'Warrant contains case number',
      status: AnalysisStatus.PASS,
      confidence: AnalysisConfidence.HIGH,
      evidence: 'Case number found on page 1',
    },
    {
      category: 'Preliminary Information',
      requirement: 'Warrant is signed by judge',
      status: AnalysisStatus.FAIL,
      confidence: AnalysisConfidence.HIGH,
      evidence: 'No signature found',
    },
    {
      category: 'Scope',
      requirement: 'Items to be seized are specified',
      status: AnalysisStatus.PARTIAL,
      confidence: AnalysisConfidence.MEDIUM,
      evidence: 'Some items listed but description is vague',
    },
  ];

  it('should render table headers', () => {
    render(<ChecklistTable items={mockItems} />);

    expect(screen.getByText('Requirement')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Confidence')).toBeInTheDocument();
    expect(screen.getByText('Document Evidence & Reasoning')).toBeInTheDocument();
  });

  it('should render all items', () => {
    render(<ChecklistTable items={mockItems} />);

    expect(screen.getByText('Warrant contains case number')).toBeInTheDocument();
    expect(screen.getByText('Warrant is signed by judge')).toBeInTheDocument();
    expect(screen.getByText('Items to be seized are specified')).toBeInTheDocument();
  });

  it('should render status badges for all items', () => {
    render(<ChecklistTable items={mockItems} />);

    expect(screen.getByText('PASS')).toBeInTheDocument();
    expect(screen.getByText('FAIL')).toBeInTheDocument();
    expect(screen.getByText('PARTIAL')).toBeInTheDocument();
  });

  it('should render confidence badges', () => {
    render(<ChecklistTable items={mockItems} />);

    expect(screen.getAllByText('HIGH')).toHaveLength(2);
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
  });

  it('should render evidence for all items', () => {
    render(<ChecklistTable items={mockItems} />);

    expect(screen.getByText('Case number found on page 1')).toBeInTheDocument();
    expect(screen.getByText('No signature found')).toBeInTheDocument();
    expect(screen.getByText('Some items listed but description is vague')).toBeInTheDocument();
  });

  it('should render empty table when no items', () => {
    render(<ChecklistTable items={[]} />);

    expect(screen.getByText('Requirement')).toBeInTheDocument();
    expect(screen.queryByRole('row')).toBeInTheDocument(); // Header row exists
  });
});
