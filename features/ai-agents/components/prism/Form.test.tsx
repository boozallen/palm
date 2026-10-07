import { render, screen } from '@testing-library/react';

import Form from './Form';

jest.mock('@/features/shared/api/get-available-models', () => ({
  __esModule: true,
  default: () => ({
    data: {
      availableModels: [
        { id: 'model-1', name: 'Claude 3.5 Sonnet', providerLabel: 'Anthropic' },
        { id: 'model-2', name: 'GPT-4', providerLabel: 'OpenAI' },
      ],
    },
  }),
}));

jest.mock('./RequirementsFormatGuide', () => {
  return function MockRequirementsFormatGuide() {
    return <div data-testid='requirements-format-guide' />;
  };
});

describe('Form', () => {
  const mockAgentId = '7365c7c3-d10f-48cb-bfbc-0c2566f29599';
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the requirements file input', () => {
    render(<Form agentId={mockAgentId} isLoading={false} onSubmit={mockOnSubmit} />);

    expect(screen.getByText('Requirements Spreadsheet')).toBeInTheDocument();
  });

  it('renders the proposal file input', () => {
    render(<Form agentId={mockAgentId} isLoading={false} onSubmit={mockOnSubmit} />);

    expect(screen.getByText('Proposal Document')).toBeInTheDocument();
  });

  it('renders the model select', () => {
    render(<Form agentId={mockAgentId} isLoading={false} onSubmit={mockOnSubmit} />);

    expect(screen.getByText('Model')).toBeInTheDocument();
  });

  it('renders the Analyze button', () => {
    render(<Form agentId={mockAgentId} isLoading={false} onSubmit={mockOnSubmit} />);

    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument();
  });

  it('renders the RequirementsFormatGuide', () => {
    render(<Form agentId={mockAgentId} isLoading={false} onSubmit={mockOnSubmit} />);

    expect(screen.getByTestId('requirements-format-guide')).toBeInTheDocument();
  });

  it('renders the requirements file input as required', () => {
    render(<Form agentId={mockAgentId} isLoading={false} onSubmit={mockOnSubmit} />);

    const label = screen.getByText('Requirements Spreadsheet');
    expect(label.parentElement?.textContent).toContain('*');
  });

  it('renders the proposal file input as required', () => {
    render(<Form agentId={mockAgentId} isLoading={false} onSubmit={mockOnSubmit} />);

    const label = screen.getByText('Proposal Document');
    expect(label.parentElement?.textContent).toContain('*');
  });

  it('renders the form element with data-testid', () => {
    const { container } = render(
      <Form agentId={mockAgentId} isLoading={false} onSubmit={mockOnSubmit} />,
    );

    expect(container.querySelector('[data-testid="prism-form"]')).toBeInTheDocument();
  });

  it('disables the submit button when loading', () => {
    render(<Form agentId={mockAgentId} isLoading={true} onSubmit={mockOnSubmit} />);

    const button = screen.getByRole('button', { name: /analyzing/i });
    expect(button).toBeDisabled();
  });

  it('shows Analyzing text when loading', () => {
    render(<Form agentId={mockAgentId} isLoading={true} onSubmit={mockOnSubmit} />);

    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
  });

  it('accepts .xlsx files for requirements input', () => {
    const { container } = render(
      <Form agentId={mockAgentId} isLoading={false} onSubmit={mockOnSubmit} />,
    );

    const fileInputs = container.querySelectorAll('input[type="file"]');
    const requirementsInput = fileInputs[0];

    expect(requirementsInput).toHaveAttribute('accept', expect.stringContaining('.xlsx'));
  });

  it('accepts .pdf and .docx files for proposal input', () => {
    const { container } = render(
      <Form agentId={mockAgentId} isLoading={false} onSubmit={mockOnSubmit} />,
    );

    const fileInputs = container.querySelectorAll('input[type="file"]');
    const proposalInput = fileInputs[1];

    expect(proposalInput).toHaveAttribute('accept', expect.stringContaining('.pdf'));
    expect(proposalInput).toHaveAttribute('accept', expect.stringContaining('.docx'));
  });
});
