import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import ToolCallRow from './ToolCallRow';
import { AgentTraceStep, AgentTraceStepStatus, AgentTraceStepType } from '@/features/chat/types/agent-trace';
import { useCreateClientSideAuditRecord } from '@/features/shared/api/create-client-side-audit-record';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { Artifact } from '@/features/chat/types/message';

jest.mock('@mantine/prism', () => ({
  Prism: ({ children, language, noCopy }: any) => (
    <div data-testid='mocked-prism' data-language={language} data-no-copy={noCopy}>
      {children}
    </div>
  ),
}));

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

const mockArtifact: Artifact = {
  id: '0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62',
  fileExtension: '.pptx',
  label: 'Durham One Call AI Chatbot',
  content: '',
  chatMessageId: 'ce1f6a2f-9f5f-4d4e-8f9a-5d3ba2a35f2b',
  githubPagesUrl: null,
  githubUrl: null,
  createdAt: new Date(),
};

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider withGlobalStyles withNormalizeCSS>
      {component}
    </MantineProvider>
  );
};

describe('ToolCallRow', () => {
  const mockCreateAuditRecord = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCreateClientSideAuditRecord as jest.Mock).mockReturnValue({
      mutate: mockCreateAuditRecord,
    });
    (useChat as jest.Mock).mockReturnValue({ setSelectedArtifact: jest.fn() });
  });

  it('records expanding a tool call as a panel toggle', () => {
    const step: AgentTraceStep = {
      id: 'bash-5',
      type: AgentTraceStepType.SubagentToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'Bash',
      toolLabel: '$ ls',
      toolArgs: { command: 'ls' },
    };

    renderWithMantine(<ToolCallRow step={step} />);
    fireEvent.click(screen.getByTestId(`tool-call-toggle-${step.id}`));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.TogglePanel,
      label: 'Expand tool call',
    });
  });

  it('records collapsing a tool call with the state being moved to', () => {
    const step: AgentTraceStep = {
      id: 'bash-6',
      type: AgentTraceStepType.SubagentToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'Bash',
      toolLabel: '$ ls',
      toolArgs: { command: 'ls' },
    };

    renderWithMantine(<ToolCallRow step={step} />);
    const toggle = screen.getByTestId(`tool-call-toggle-${step.id}`);
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(mockCreateAuditRecord).toHaveBeenCalledTimes(2);
    expect(mockCreateAuditRecord.mock.calls[1][0]).toEqual({
      event: AuditRecordEvent.TogglePanel,
      label: 'Collapse tool call',
    });
  });

  it('records nothing when a tool call has no expandable content', () => {
    const step: AgentTraceStep = {
      id: 'bash-7',
      type: AgentTraceStepType.SubagentToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'Bash',
      toolLabel: 'Bash',
    };

    renderWithMantine(<ToolCallRow step={step} />);
    fireEvent.click(screen.getByTestId(`tool-call-toggle-${step.id}`));

    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('records toggling the raw response view', () => {
    const step: AgentTraceStep = {
      id: 'raw-1',
      type: AgentTraceStepType.SubagentToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'search',
      toolLabel: 'Searching',
      rawOutput: { hits: 3 },
    };

    renderWithMantine(<ToolCallRow step={step} />);
    fireEvent.click(screen.getByText('View raw response'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.TogglePanel,
      label: 'View raw response',
    });

    fireEvent.click(screen.getByText('Hide raw response'));

    expect(mockCreateAuditRecord).toHaveBeenLastCalledWith({
      event: AuditRecordEvent.TogglePanel,
      label: 'Hide raw response',
    });
  });

  it('shows the edited file name and diff badges on the collapsed row for a single-artifact edit call', () => {
    const step: AgentTraceStep = {
      id: 'edit-1',
      type: AgentTraceStepType.ToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'edit_pptx',
      toolLabel: 'Editing PowerPoint...',
      results: [{ title: 'Durham One Call AI Chatbot – RFP #25-0011 Response Strategy.pptx', artifact: mockArtifact }],
      diffStat: { added: 146, removed: 24 },
    };

    renderWithMantine(<ToolCallRow step={step} />);

    const toggle = screen.getByTestId(`tool-call-toggle-${step.id}`);
    expect(toggle).toHaveTextContent('Durham One Call AI Chatbot – RFP #25-0011 Response Strategy.pptx');
    expect(screen.getByText('+146')).toBeInTheDocument();
    expect(screen.getByText('-24')).toBeInTheDocument();
    expect(toggle).not.toHaveTextContent('Editing PowerPoint');
    expect(toggle).not.toHaveTextContent('artifact');
  });

  it('does not offer to expand a single-artifact edit call, since the row already shows everything', () => {
    const step: AgentTraceStep = {
      id: 'edit-2',
      type: AgentTraceStepType.ToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'edit_pptx',
      toolLabel: 'Editing PowerPoint...',
      results: [{ title: 'Durham One Call AI Chatbot – RFP #25-0011 Response Strategy.pptx', artifact: mockArtifact }],
      diffStat: { added: 146, removed: 24 },
    };

    renderWithMantine(<ToolCallRow step={step} />);

    expect(screen.getByTestId(`tool-call-toggle-${step.id}`)).toHaveStyle({ cursor: 'default' });
  });

  it('keeps the label and pluralized count for an edit call touching multiple artifacts', () => {
    const step: AgentTraceStep = {
      id: 'edit-3',
      type: AgentTraceStepType.ToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'edit_pptx',
      toolLabel: 'Editing PowerPoint...',
      resultCount: 2,
      results: [
        { title: 'Deck A.pptx', artifact: mockArtifact },
        { title: 'Deck B.pptx', artifact: mockArtifact },
      ],
    };

    renderWithMantine(<ToolCallRow step={step} />);

    const toggle = screen.getByTestId(`tool-call-toggle-${step.id}`);
    expect(toggle).toHaveTextContent('Editing PowerPoint');
    expect(toggle).toHaveTextContent('2 artifacts');
  });

  it('shows a filename and file icon while a document is still being generated', () => {
    const step: AgentTraceStep = {
      id: 'create-1',
      type: AgentTraceStepType.ToolCall,
      status: AgentTraceStepStatus.Running,
      toolName: 'create_docx',
      toolLabel: 'Generating document: 10 Proposal',
      toolArgs: { title: '10 Proposal', output_type: 'document' },
    };

    renderWithMantine(<ToolCallRow step={step} />);

    const toggle = screen.getByTestId(`tool-call-toggle-${step.id}`);
    expect(toggle).toHaveTextContent('10 Proposal.docx');
    expect(toggle).not.toHaveTextContent('Generating document');
  });

  it('falls back to the tool label before a title has streamed in for a create call', () => {
    const step: AgentTraceStep = {
      id: 'create-2',
      type: AgentTraceStepType.ToolCall,
      status: AgentTraceStepStatus.Running,
      toolName: 'create_docx',
      toolLabel: 'Generating document...',
      toolArgs: { output_type: 'document' },
    };

    renderWithMantine(<ToolCallRow step={step} />);

    expect(screen.getByTestId(`tool-call-toggle-${step.id}`)).toHaveTextContent('Generating document...');
  });

  it('shows the created file name on the collapsed row for a single-artifact create call', () => {
    const step: AgentTraceStep = {
      id: 'create-3',
      type: AgentTraceStepType.ToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'create_docx',
      toolLabel: 'Generating document: 10 Proposal',
      results: [{ title: '10 Proposal.docx', artifact: mockArtifact }],
    };

    renderWithMantine(<ToolCallRow step={step} />);

    const toggle = screen.getByTestId(`tool-call-toggle-${step.id}`);
    expect(toggle).toHaveTextContent('10 Proposal.docx');
    expect(toggle).not.toHaveTextContent('Generating document');
  });

  it('renders the full multi-line bash command with line breaks preserved, not collapsed into one line', () => {
    const command = 'mkdir -p /tmp/demo\ncat << \'EOF\' > /tmp/demo/build.py\nprint(\'hi\')\nEOF';
    const step: AgentTraceStep = {
      id: 'bash-2',
      type: AgentTraceStepType.SubagentToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'Bash',
      toolLabel: '$ mkdir -p /tmp/demo …',
      toolArgs: { command },
    };

    renderWithMantine(<ToolCallRow step={step} />);
    fireEvent.click(screen.getByTestId(`tool-call-toggle-${step.id}`));

    expect(screen.getByTestId('mocked-prism').textContent).toBe(command);
  });

  it('shows only the Ran command tag in the collapsed row, not a command preview', () => {
    const step: AgentTraceStep = {
      id: 'bash-3',
      type: AgentTraceStepType.SubagentToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'Bash',
      toolLabel: '$ cat /tmp/demo/build.py',
      toolArgs: { command: 'cat /tmp/demo/build.py' },
    };

    renderWithMantine(<ToolCallRow step={step} />);

    const toggle = screen.getByTestId(`tool-call-toggle-${step.id}`);
    expect(toggle).toHaveTextContent('Ran command');
    expect(toggle).not.toHaveTextContent('cat /tmp/demo/build.py');
  });

  it('does not offer to expand a bash step with no command', () => {
    const step: AgentTraceStep = {
      id: 'bash-4',
      type: AgentTraceStepType.SubagentToolCall,
      status: AgentTraceStepStatus.Done,
      toolName: 'Bash',
      toolLabel: 'Bash',
    };

    renderWithMantine(<ToolCallRow step={step} />);

    fireEvent.click(screen.getByTestId(`tool-call-toggle-${step.id}`));
    expect(screen.queryByTestId(`tool-call-bash-command-${step.id}`)).not.toBeInTheDocument();
  });
});
