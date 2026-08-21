import { render, screen, fireEvent } from '@testing-library/react';

import LlmAnalysis from './LlmAnalysis';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

const mockCreateAuditRecord = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: () => ({ mutate: mockCreateAuditRecord }),
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/components/content/Markdown', () => ({
  __esModule: true,
  default: jest.fn(({ value }) => <div data-testid='markdown-content'>{value}</div>),
}));

describe('LlmAnalysis', () => {
  const mockAnalysis = `# Test Analysis
  
This is a test analysis with some markdown.

## Section 1

* Bullet point 1
* Bullet point 2

## Section 2

1. Numbered item 1
2. Numbered item 2`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the correct title', () => {
    render(<LlmAnalysis analysis={mockAnalysis} />);
    expect(screen.getByText('Research Report')).toBeInTheDocument();
  });

  it('passes the analysis content to the Markdown component', () => {
    render(<LlmAnalysis analysis={mockAnalysis} />);
    
    const markdownContent = screen.getByTestId('markdown-content');
    expect(markdownContent).toBeInTheDocument();
    expect(markdownContent).toHaveTextContent('Test Analysis');
    expect(markdownContent).toHaveTextContent('This is a test analysis');
    expect(markdownContent).toHaveTextContent('Section 1');
    expect(markdownContent).toHaveTextContent('Bullet point');
    expect(markdownContent).toHaveTextContent('Section 2');
    expect(markdownContent).toHaveTextContent('Numbered item');
  });

  it('records an audit record when the copy button is clicked', () => {
    render(<LlmAnalysis analysis={mockAnalysis} />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.CopyContentToClipboard,
      label: 'RADAR research report',
    });
  });
});
