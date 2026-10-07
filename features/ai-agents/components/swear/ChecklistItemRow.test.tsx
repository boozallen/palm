import { render, screen } from '@testing-library/react';

import ChecklistItemRow from './ChecklistItemRow';
import { AnalysisStatus, AnalysisConfidence } from '@/features/ai-agents/types/swear/analysisItem';
import type { AnalysisItem } from '@/features/ai-agents/types/swear/analysisItem';

describe('ChecklistItemRow', () => {
  const mockItem: AnalysisItem = {
    category: 'Preliminary Information',
    requirement: 'Warrant contains case number',
    status: AnalysisStatus.PASS,
    confidence: AnalysisConfidence.HIGH,
    evidence: 'Case number 2024-CR-12345 found on page 1',
  };

  const renderInTable = (item: AnalysisItem) => {
    return render(
      <table>
        <tbody>
          <ChecklistItemRow item={item} />
        </tbody>
      </table>
    );
  };

  it('should render requirement text', () => {
    renderInTable(mockItem);

    expect(screen.getByText('Warrant contains case number')).toBeInTheDocument();
  });

  it('should render status badge', () => {
    renderInTable(mockItem);

    expect(screen.getByText('PASS')).toBeInTheDocument();
  });

  it('should render confidence badge', () => {
    renderInTable(mockItem);

    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('should render evidence text', () => {
    renderInTable(mockItem);

    expect(screen.getByText('Case number 2024-CR-12345 found on page 1')).toBeInTheDocument();
  });

  it('should render FAIL status with correct styling', () => {
    const failItem: AnalysisItem = {
      ...mockItem,
      status: AnalysisStatus.FAIL,
    };

    renderInTable(failItem);

    expect(screen.getByText('FAIL')).toBeInTheDocument();
  });

  it('should render PARTIAL status', () => {
    const partialItem: AnalysisItem = {
      ...mockItem,
      status: AnalysisStatus.PARTIAL,
    };

    renderInTable(partialItem);

    expect(screen.getByText('PARTIAL')).toBeInTheDocument();
  });

  it('should render N/A status', () => {
    const naItem: AnalysisItem = {
      ...mockItem,
      status: AnalysisStatus.NA,
    };

    renderInTable(naItem);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should render LOW confidence', () => {
    const lowConfidenceItem: AnalysisItem = {
      ...mockItem,
      confidence: AnalysisConfidence.LOW,
    };

    renderInTable(lowConfidenceItem);

    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  it('should render MEDIUM confidence', () => {
    const mediumConfidenceItem: AnalysisItem = {
      ...mockItem,
      confidence: AnalysisConfidence.MEDIUM,
    };

    renderInTable(mediumConfidenceItem);

    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
  });
});
