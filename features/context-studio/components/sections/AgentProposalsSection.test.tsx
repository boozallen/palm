import { fireEvent, render, screen } from '@testing-library/react';
import AgentProposalsSection from './AgentProposalsSection';
import { AgentProposalJob } from '@/features/context-studio/types/context-studio';

const CAPTURED: AgentProposalJob = {
  jobId: 'prism-1',
  agentType: 'PRISM',
  agentName: 'PRISM - Navy',
  status: 'completed',
  createdAt: '2026-09-24T14:02:00.000Z',
  proposalName: 'NGEN Recompete',
  clientName: 'U.S. Navy',
  opportunitySummary: 'Enterprise network services for the Navy.',
  financialValue: '$2.1B ceiling',
  fallbackFilename: 'volume-1.docx',
  userName: 'Josh Gordon',
  userEmail: 'jgordon@example.com',
};

const NOT_CAPTURED: AgentProposalJob = {
  jobId: 'odram-1',
  agentType: 'ODRAM',
  agentName: 'ODRAM',
  status: 'error',
  createdAt: '2026-09-20T10:00:00.000Z',
  proposalName: null,
  clientName: null,
  opportunitySummary: null,
  financialValue: null,
  fallbackFilename: 'odram-responses.xlsx',
  userName: 'Pat Lee',
  userEmail: null,
};

describe('AgentProposalsSection', () => {
  it('shows a skeleton while loading', () => {
    render(<AgentProposalsSection jobs={undefined} loading failed={false} />);

    expect(screen.getByTestId('agent-proposals-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-proposals-section')).not.toBeInTheDocument();
  });

  it('shows the load error when the query fails', () => {
    render(<AgentProposalsSection jobs={undefined} loading={false} failed />);

    expect(screen.getByTestId('studio-load-error')).toBeInTheDocument();
  });

  it('renders nothing when there are no jobs', () => {
    const { container } = render(<AgentProposalsSection jobs={[]} loading={false} failed={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders one row per job with captured details', () => {
    render(<AgentProposalsSection jobs={[CAPTURED, NOT_CAPTURED]} loading={false} failed={false} />);

    const row = screen.getByTestId('agent-proposal-row-prism-1');
    expect(row).toHaveTextContent('NGEN Recompete');
    expect(row).toHaveTextContent('U.S. Navy');
    expect(row).toHaveTextContent('$2.1B ceiling');
    expect(screen.getByTestId('agent-proposal-row-odram-1')).toBeInTheDocument();
  });

  it('shows which agent ran each job', () => {
    render(<AgentProposalsSection jobs={[CAPTURED, NOT_CAPTURED]} loading={false} failed={false} />);

    expect(screen.getByTestId('agent-proposal-agent-prism-1')).toHaveTextContent('PRISM');
    expect(screen.getByTestId('agent-proposal-agent-prism-1')).toHaveTextContent('PRISM - Navy');
    expect(screen.getByTestId('agent-proposal-agent-odram-1')).toHaveTextContent('ODRAM');
  });

  it('marks runs without captured details with their filename', () => {
    render(<AgentProposalsSection jobs={[CAPTURED, NOT_CAPTURED]} loading={false} failed={false} />);

    expect(screen.getByTestId('agent-proposal-fallback-odram-1')).toHaveTextContent('odram-responses.xlsx');
    expect(screen.queryByTestId('agent-proposal-fallback-prism-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('agent-proposal-row-odram-1')).toHaveTextContent('—');
  });

  it('links the runner by email when one exists', () => {
    render(<AgentProposalsSection jobs={[CAPTURED]} loading={false} failed={false} />);

    const link = screen.getByTestId('agent-proposal-run-by-prism-1').querySelector('a');
    expect(link).toHaveAttribute('href', 'mailto:jgordon@example.com');
  });

  it('shows the runner as plain text when they have no email', () => {
    render(<AgentProposalsSection jobs={[NOT_CAPTURED]} loading={false} failed={false} />);

    const cell = screen.getByTestId('agent-proposal-run-by-odram-1');
    expect(cell).toHaveTextContent('Pat Lee');
    expect(cell.querySelector('a')).toBeNull();
  });

  it('expands a row to show the opportunity summary and collapses it again', () => {
    render(<AgentProposalsSection jobs={[CAPTURED]} loading={false} failed={false} />);

    expect(screen.queryByTestId('agent-proposal-summary-prism-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('agent-proposal-row-prism-1'));
    expect(screen.getByTestId('agent-proposal-summary-prism-1')).toHaveTextContent('Enterprise network services for the Navy.');

    fireEvent.click(screen.getByTestId('agent-proposal-row-prism-1'));
    expect(screen.queryByTestId('agent-proposal-summary-prism-1')).not.toBeInTheDocument();
  });

  it('still expands a row that has no summary', () => {
    render(<AgentProposalsSection jobs={[NOT_CAPTURED]} loading={false} failed={false} />);

    fireEvent.click(screen.getByTestId('agent-proposal-row-odram-1'));

    expect(screen.getByTestId('agent-proposal-summary-odram-1')).toBeInTheDocument();
  });

  it('does not expand the row when the email link is clicked', () => {
    render(<AgentProposalsSection jobs={[CAPTURED]} loading={false} failed={false} />);

    const link = screen.getByTestId('agent-proposal-run-by-prism-1').querySelector('a') as HTMLAnchorElement;
    fireEvent.click(link);

    expect(screen.queryByTestId('agent-proposal-summary-prism-1')).not.toBeInTheDocument();
  });
});
