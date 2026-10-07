import { render, screen } from '@testing-library/react';

import ResultsTable from './ResultsTable';
import { ComplianceStatus } from '@/features/ai-agents/types/prism/complianceResult';
import type { ComplianceResult } from '@/features/ai-agents/types/prism/complianceResult';

jest.mock('./ResultRow', () => {
  return function MockResultRow({ item, showCitations }: {
    item: ComplianceResult;
    showCitations: boolean;
  }) {
    return (
      <tr data-testid='result-row' data-show-citations={showCitations}>
        <td>{item.requirement}</td>
      </tr>
    );
  };
});

const makeItem = (overrides: Partial<ComplianceResult> = {}): ComplianceResult => ({
  id: `result-${Math.random()}`,
  jobId: 'job-1',
  category: null,
  requirement: 'A requirement',
  complianceStatus: ComplianceStatus.YES,
  reasoning: 'Reasoning text',
  citations: null,
  sortOrder: 0,
  ...overrides,
});

describe('ResultsTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const onShowCitationsChange = jest.fn();

  it('renders table headers', () => {
    render(<ResultsTable showCitations={false} onShowCitationsChange={onShowCitationsChange} items={[makeItem()]} />);

    expect(screen.getByText('Requirement')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.getByText('Citations')).toBeInTheDocument();
  });

  it('does not render a Category column header', () => {
    render(<ResultsTable showCitations={false} onShowCitationsChange={onShowCitationsChange} items={[makeItem({ category: 'Technical' })]} />);

    expect(screen.queryByText('Category')).not.toBeInTheDocument();
  });

  it('renders category tabs when items have categories', () => {
    const items = [
      makeItem({ category: 'Technical' }),
      makeItem({ category: 'Security' }),
    ];

    render(<ResultsTable showCitations={false} onShowCitationsChange={onShowCitationsChange} items={items} />);

    expect(screen.getByRole('tab', { name: 'Technical' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Security' })).toBeInTheDocument();
  });

  it('does not render tabs when items have no categories', () => {
    render(<ResultsTable showCitations={false} onShowCitationsChange={onShowCitationsChange} items={[makeItem({ category: null })]} />);

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('renders a row for each item', () => {
    const items = [makeItem(), makeItem(), makeItem()];

    render(<ResultsTable showCitations={false} onShowCitationsChange={onShowCitationsChange} items={items} />);

    expect(screen.getAllByTestId('result-row')).toHaveLength(3);
  });

  it('renders only the active category items by default', () => {
    const items = [
      makeItem({ id: 'a', category: 'Technical', requirement: 'Tech req' }),
      makeItem({ id: 'b', category: 'Security', requirement: 'Sec req' }),
    ];

    render(<ResultsTable showCitations={false} onShowCitationsChange={onShowCitationsChange} items={items} />);

    // First category is active by default
    expect(screen.getByText('Tech req')).toBeInTheDocument();
    expect(screen.queryByText('Sec req')).not.toBeInTheDocument();
  });

  it('renders citations toggle switch', () => {
    render(<ResultsTable showCitations={false} onShowCitationsChange={onShowCitationsChange} items={[makeItem()]} />);

    expect(screen.getByRole('switch', { name: /toggle citations/i })).toBeInTheDocument();
  });

  it('does not render pagination when items fit on one page', () => {
    const items = Array.from({ length: 5 }, () => makeItem());

    render(<ResultsTable showCitations={false} onShowCitationsChange={onShowCitationsChange} items={items} />);

    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });

  it('renders pagination when items exceed one page', () => {
    const items = Array.from({ length: 55 }, () => makeItem());

    render(<ResultsTable showCitations={false} onShowCitationsChange={onShowCitationsChange} items={items} />);

    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
  });

  it('renders empty table body when no items', () => {
    render(<ResultsTable showCitations={false} onShowCitationsChange={onShowCitationsChange} items={[]} />);

    expect(screen.queryAllByTestId('result-row')).toHaveLength(0);
  });
});
