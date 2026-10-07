import { buildAgentTraceFromData, buildAgentTraceFromProgressMessages } from './buildAgentTrace';
import { AgentTraceStepType } from '@/features/chat/types/agent-trace';
import { Artifact, Citation, ContextType } from '@/features/chat/types/message';

describe('buildAgentTraceFromData', () => {
  const mockArtifact: Artifact = {
    id: '0f38ff1b-38ea-4a52-9bc0-1e4c17b0ff62',
    fileExtension: '.pptx',
    label: 'History of Booz Allen Hamilton',
    content: 'abc',
    chatMessageId: 'ce1f6a2f-9f5f-4d4e-8f9a-5d3ba2a35f2b',
    githubPagesUrl: null,
    githubUrl: null,
    createdAt: new Date(),
  };

  it('backfills diffStat onto the matching edit_* tool_call step', () => {
    const steps = buildAgentTraceFromData({
      progressMessages: [
        JSON.stringify({ type: 'tool_call', toolName: 'edit_pptx', label: 'Editing PowerPoint...' }),
        JSON.stringify({ type: 'artifact_diff_stat', toolName: 'edit_pptx', added: 3, removed: 1 }),
      ],
      artifactCount: 1,
      artifacts: [mockArtifact],
    });

    const editStep = steps.find((s) => s.toolName === 'edit_pptx');
    expect(editStep?.diffStat).toEqual({ added: 3, removed: 1 });
  });

  it('attaches the full artifact object onto the matching tool_call step results', () => {
    const steps = buildAgentTraceFromData({
      progressMessages: [
        JSON.stringify({ type: 'tool_call', toolName: 'edit_pptx', label: 'Editing PowerPoint...' }),
      ],
      artifactCount: 1,
      artifacts: [mockArtifact],
    });

    const editStep = steps.find((s) => s.type === AgentTraceStepType.ToolCall && s.toolName === 'edit_pptx');
    expect(editStep?.results?.[0].artifact).toBe(mockArtifact);
  });

  it('attributes each artifact to the tool_call step that produced it, not all onto the first one', () => {
    const deckA: Artifact = { ...mockArtifact, id: 'artifact-a', label: 'Deck A', fileExtension: '.pptx' };
    const deckB: Artifact = { ...mockArtifact, id: 'artifact-b', label: 'Deck B', fileExtension: '.pptx' };

    const steps = buildAgentTraceFromData({
      progressMessages: [
        JSON.stringify({ type: 'tool_call', toolName: 'create_pptx', label: 'Generating PowerPoint: Deck A', args: { title: 'Deck A' } }),
        JSON.stringify({ type: 'tool_call', toolName: 'edit_pptx', label: 'Editing PowerPoint: Deck B', args: { title: 'Deck B' } }),
      ],
      artifactCount: 2,
      artifacts: [deckA, deckB],
    });

    const createStep = steps.find((s) => s.toolName === 'create_pptx');
    const editStep = steps.find((s) => s.toolName === 'edit_pptx');

    expect(createStep?.results).toEqual([expect.objectContaining({ artifact: deckA })]);
    expect(editStep?.results).toEqual([expect.objectContaining({ artifact: deckB })]);
  });

  it('does not set diffStat on an unrelated tool_call step when the toolName does not match', () => {
    const steps = buildAgentTraceFromData({
      progressMessages: [
        JSON.stringify({ type: 'tool_call', toolName: 'edit_docx', label: 'Editing document...' }),
        JSON.stringify({ type: 'artifact_diff_stat', toolName: 'edit_pptx', added: 2, removed: 0 }),
      ],
    });

    const docxStep = steps.find((s) => s.toolName === 'edit_docx');
    expect(docxStep?.diffStat).toBeUndefined();
  });
});

describe('buildAgentTraceFromProgressMessages', () => {
  it('shortens a multi-line bash command to its first line, keeping the full command in toolArgs', () => {
    const command = 'mkdir -p /tmp/demo\ncat << \'EOF\' > /tmp/demo/build.py\nprint(\'hi\')\nEOF';
    const messages = [
      JSON.stringify({ type: 'subagent_tool_call', tool: 'Bash', args: { command }, step: 1 }),
    ];

    const steps = buildAgentTraceFromProgressMessages(messages);
    const bashStep = steps.find((s) => s.type === AgentTraceStepType.SubagentToolCall);

    expect(bashStep?.toolLabel).toBe('$ mkdir -p /tmp/demo …');
    expect(bashStep?.toolArgs?.command).toBe(command);
  });

  it('leaves a single-line bash command label untruncated', () => {
    const messages = [
      JSON.stringify({ type: 'subagent_tool_call', tool: 'Bash', args: { command: 'ls -la' }, step: 1 }),
    ];

    const steps = buildAgentTraceFromProgressMessages(messages);
    const bashStep = steps.find((s) => s.type === AgentTraceStepType.SubagentToolCall);

    expect(bashStep?.toolLabel).toBe('$ ls -la');
  });
});

describe('buildAgentTraceFromData prior-conversation binding', () => {
  const priorCitation: Citation = {
    contextType: ContextType.PRIOR_CONVERSATION,
    citedMessageId: 'message-1',
    chatId: 'chat-1',
    sourceLabel: 'Architecture decisions',
    citation: 'We decided to use pgvector.',
  };

  it('binds a conversationResult event to the latest memory tool, not search', () => {
    const steps = buildAgentTraceFromData({
      progressMessages: [
        JSON.stringify({ type: 'tool_call', toolName: 'search', label: 'Search documents' }),
        JSON.stringify({ type: 'tool_call', toolName: 'search_conversations', label: 'Search chats' }),
        JSON.stringify({ type: 'collect_citations', conversationResult: true, rowCount: 2 }),
      ],
    });

    const searchStep = steps.find((step) => step.toolName === 'search');
    const memoryStep = steps.find((step) => step.toolName === 'search_conversations');
    expect(searchStep?.resultCount).toBeUndefined();
    expect(memoryStep?.resultCount).toBe(2);
  });

  it('keeps prior-conversation citations out of the document-library fold', () => {
    const documentCitation: Citation = {
      contextType: ContextType.DOCUMENT_LIBRARY,
      documentId: 'document-1',
      sourceLabel: 'Design.pdf',
      citation: 'Document excerpt',
    };
    const steps = buildAgentTraceFromData({
      progressMessages: [
        JSON.stringify({ type: 'tool_call', toolName: 'get_library_documents' }),
        JSON.stringify({ type: 'tool_call', toolName: 'get_conversation_messages' }),
      ],
      citations: [documentCitation, priorCitation],
      citationCount: 2,
    });

    const documentStep = steps.find((step) => step.toolName === 'get_library_documents');
    const memoryStep = steps.find((step) => step.toolName === 'get_conversation_messages');
    expect(documentStep?.resultCount).toBe(1);
    expect(documentStep?.results).toEqual([{ title: 'Design.pdf', subtitle: undefined }]);
    expect(memoryStep?.resultCount).toBe(1);
    expect(memoryStep?.results).toEqual([
      { title: 'Architecture decisions', subtitle: 'We decided to use pgvector.' },
    ]);
  });

  it('synthesizes a completed memory step after refresh when no memory tool step remains', () => {
    const steps = buildAgentTraceFromData({
      citations: [priorCitation],
    });

    expect(steps).toEqual([
      expect.objectContaining({
        type: AgentTraceStepType.ToolCall,
        toolName: 'search_conversations',
        toolLabel: 'Searched prior conversations',
        resultCount: 1,
      }),
    ]);
  });
});
