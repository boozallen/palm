import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/router';

import { ChatProvider, useChat } from './ChatProvider';
import { Artifact } from '@/features/chat/types/message';
import { useGetUserGraphDatabaseAccess } from '@/features/shared/api/get-user-graph-database-access';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { renderWrapper } from '@/test/test-utils';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/api/get-user-graph-database-access', () => ({
  useGetUserGraphDatabaseAccess: jest.fn(),
}));

jest.mock('@/features/shared/api/get-system-config', () => ({
  useGetSystemConfig: jest.fn(),
}));

jest.mock('@/features/shared/api/document-upload/get-documents', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const TestComponent = () => {
  const chatContext = useChat();
  return (
    <div data-testid='test-component'>
      <div data-testid='context-value'>{JSON.stringify(chatContext)}</div>
      <button onClick={() => chatContext.setChatId('new-chat')}>
        Set Chat ID
      </button>
      <button onClick={() => chatContext.setPromptId('new-prompt')}>
        Set Prompt ID
      </button>
      <button onClick={() => chatContext.setModelId('new-model')}>
        Set Model ID
      </button>
      <button onClick={() => chatContext.setPendingMessage('new message')}>
        Set Pending Message
      </button>
      <button onClick={() => chatContext.setIsLastMessageRetry(true)}>
        Set Last Message Retry
      </button>
      <button onClick={() => chatContext.setRegeneratingResponse(true)}>
        Set Regenerating Response
      </button>
      <button onClick={() => chatContext.setKnowledgeBaseIds(['kb3', 'kb4'])}>
        Set Knowledge Base IDs
      </button>
      <button onClick={() => chatContext.setDocumentIds(['doc-1', 'doc-2'])}>
        Set Document IDs
      </button>
      <button onClick={() => chatContext.setDeepResearchEnabled(true)}>
        Set Deep Research Enabled
      </button>
      <button onClick={() => chatContext.setUseGraph(true)}>
        Set Use Graph
      </button>
      <button onClick={() => {
        const artifact: Artifact = {
          id: 'artifact-1',
          fileExtension: 'txt',
          label: 'Test Artifact',
          content: 'This is a test artifact',
          chatMessageId: 'msg-1',
          githubPagesUrl: null,
          createdAt: new Date(),
        };
        chatContext.setSelectedArtifact(artifact);
      }}>
        Set Selected Artifact
      </button>
      <button onClick={() => chatContext.setSystemMessage('This is your persona')}>
        Set System Message
      </button>
      <button onClick={() => chatContext.setSelectedText('Test selected text')}>
        Set Selected Text
      </button>
      <button onClick={() => chatContext.setEntryBeingEdited('entry-1')}>
        Set Entry Being Edited
      </button>
      <button onClick={() => chatContext.setSourcesSidebarExpanded(true)}>
        Set Sources Sidebar Expanded
      </button>
      <button onClick={() => chatContext.setAllSourcesSelected(true)}>
        Set All Sources Selected
      </button>
      <button onClick={() => chatContext.setIsGeneratingGraph(true)}>
        Set Is Generating Graph
      </button>
      <button onClick={() => chatContext.setShowGraphTooltip(true)}>
        Set Show Graph Tooltip
      </button>
      <button onClick={() => chatContext.setGraphedSourceIds(['source-1', 'source-2'])}>
        Set Graphed Source IDs
      </button>
      <button onClick={() => chatContext.setGraphingSourceIds(['source-3'])}>
        Set Graphing Source IDs
      </button>
      <button onClick={() => chatContext.setRemovingGraphedSourceIds(['source-4'])}>
        Set Removing Graphed Source IDs
      </button>
      <button onClick={() => chatContext.setPrefilledMessage('Prefilled text')}>
        Set Prefilled Message
      </button>
      <button onClick={() => chatContext.setAutoSubmitMessage('Auto submit text')}>
        Set Auto Submit Message
      </button>
      <button onClick={() => chatContext.setTriggerAddSource(true)}>
        Set Trigger Add Source
      </button>
    </div>
  );
};

describe('ChatProvider', () => {
  beforeEach(() => {
    const mockRouter = {
      isReady: true,
      query: {},
      push: jest.fn(),
      replace: jest.fn(),
      pathname: '/chat',
      asPath: '/chat',
    };
    
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useGetUserGraphDatabaseAccess as jest.Mock).mockReturnValue({
      data: { hasAccess: true },
    });
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { documentLibraryDocumentUploadProviderId: '' },
    });
    (useGetDocuments as jest.Mock).mockReturnValue({
      data: [],
    });
  });

  it('provides default values when no props are passed', () => {
    renderWrapper(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    const contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );

    expect(contextValue.chatId).toBeNull();
    expect(contextValue.promptId).toBeNull();
    expect(contextValue.modelId).toBeNull();
    expect(contextValue.pendingMessage).toBeNull();
    expect(contextValue.isLastMessageRetry).toBe(false);
    expect(contextValue.regeneratingResponse).toBe(false);
    expect(contextValue.knowledgeBaseIds).toEqual([]);
    expect(contextValue.documentIds).toEqual([]);
    expect(contextValue.deepResearchEnabled).toBe(false);
    expect(contextValue.useGraph).toBe(false);
    expect(contextValue.selectedArtifact).toBeNull();
    expect(contextValue.systemMessage).toBeNull();
    expect(contextValue.selectedText).toEqual(null);
    expect(contextValue.entryBeingEdited).toBeNull();
    expect(contextValue.sourcesSidebarExpanded).toBe(false);
    expect(contextValue.allSourcesSelected).toBe(false);
    expect(contextValue.isGeneratingGraph).toBe(false);
    expect(contextValue.showGraphTooltip).toBe(false);
    expect(contextValue.graphedSourceIds).toEqual([]);
    expect(contextValue.graphingSourceIds).toEqual([]);
    expect(contextValue.removingGraphedSourceIds).toEqual([]);
    expect(contextValue.prefilledMessage).toBeNull();
    expect(contextValue.autoSubmitMessage).toBeNull();
    expect(contextValue.triggerAddSource).toBe(false);
    expect(contextValue.triggerEditSystemPrompt).toBe(false);
  });

  it('provides initial values when props are passed', () => {
    renderWrapper(
      <ChatProvider
        chatId='test-chat'
        promptId='test-prompt'
        modelId='test-model'
        initialKnowledgeBaseIds={['kb1', 'kb2']}
      >
        <TestComponent />
      </ChatProvider>
    );

    const contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );

    expect(contextValue.chatId).toBe('test-chat');
    expect(contextValue.promptId).toBe('test-prompt');
    expect(contextValue.modelId).toBe('test-model');
    expect(contextValue.knowledgeBaseIds).toEqual(['kb1', 'kb2']);
    expect(contextValue.documentIds).toEqual([]);
  });

  it('updates values when using setter functions', async () => {
    const user = userEvent.setup();
    renderWrapper(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    await user.click(screen.getByText('Set Chat ID'));
    await user.click(screen.getByText('Set Prompt ID'));
    await user.click(screen.getByText('Set Model ID'));
    await user.click(screen.getByText('Set Pending Message'));
    await user.click(screen.getByText('Set Last Message Retry'));
    await user.click(screen.getByText('Set Regenerating Response'));
    await user.click(screen.getByText('Set Knowledge Base IDs'));
    await user.click(screen.getByText('Set Document IDs'));
    await user.click(screen.getByText('Set Deep Research Enabled'));
    await user.click(screen.getByText('Set Use Graph'));
    await user.click(screen.getByText('Set Selected Artifact'));
    await user.click(screen.getByText('Set System Message'));
    await user.click(screen.getByText('Set Selected Text'));
    await user.click(screen.getByText('Set Entry Being Edited'));
    await user.click(screen.getByText('Set Sources Sidebar Expanded'));
    await user.click(screen.getByText('Set All Sources Selected'));
    await user.click(screen.getByText('Set Is Generating Graph'));
    await user.click(screen.getByText('Set Show Graph Tooltip'));
    await user.click(screen.getByText('Set Graphed Source IDs'));
    await user.click(screen.getByText('Set Graphing Source IDs'));
    await user.click(screen.getByText('Set Removing Graphed Source IDs'));
    await user.click(screen.getByText('Set Prefilled Message'));
    await user.click(screen.getByText('Set Auto Submit Message'));
    await user.click(screen.getByText('Set Trigger Add Source'));

    const contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );

    expect(contextValue.chatId).toBe('new-chat');
    expect(contextValue.promptId).toBe('new-prompt');
    expect(contextValue.modelId).toBe('new-model');
    expect(contextValue.pendingMessage).toBe('new message');
    expect(contextValue.isLastMessageRetry).toBe(true);
    expect(contextValue.regeneratingResponse).toBe(true);
    expect(contextValue.knowledgeBaseIds).toEqual(['kb3', 'kb4']);
    expect(contextValue.documentIds).toEqual(['doc-1', 'doc-2']);
    expect(contextValue.deepResearchEnabled).toBe(true);
    expect(contextValue.useGraph).toBe(true);

    const expectedArtifact: Artifact = {
      id: 'artifact-1',
      fileExtension: 'txt',
      label: 'Test Artifact',
      content: 'This is a test artifact',
      chatMessageId: 'msg-1',
      githubPagesUrl: null,
      createdAt: expect.any(String),
    };
    expect(contextValue.selectedArtifact).toMatchObject(expectedArtifact);

    expect(contextValue.systemMessage).toBe('This is your persona');
    expect(contextValue.selectedText).toBe('Test selected text');
    expect(contextValue.entryBeingEdited).toBe('entry-1');
    expect(contextValue.sourcesSidebarExpanded).toBe(true);
    expect(contextValue.allSourcesSelected).toBe(true);
    expect(contextValue.isGeneratingGraph).toBe(true);
    expect(contextValue.showGraphTooltip).toBe(true);
    expect(contextValue.graphedSourceIds).toEqual(['source-1', 'source-2']);
    expect(contextValue.graphingSourceIds).toEqual(['source-3']);
    expect(contextValue.removingGraphedSourceIds).toEqual(['source-4']);
    expect(contextValue.prefilledMessage).toBe('Prefilled text');
    expect(contextValue.autoSubmitMessage).toBe('Auto submit text');
    expect(contextValue.triggerAddSource).toBe(true);
    expect(contextValue.triggerEditSystemPrompt).toBe(false);
  });

  it('manages selected text correctly', async () => {
    const user = userEvent.setup();
    renderWrapper(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    // set selected text
    await user.click(screen.getByText('Set Selected Text'));

    let contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );

    expect(contextValue.selectedText).toEqual('Test selected text');
  });

  it('manages document IDs correctly', async () => {
    const user = userEvent.setup();
    renderWrapper(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    // Initial state
    let contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );
    expect(contextValue.documentIds).toEqual([]);

    // Set document IDs
    await user.click(screen.getByText('Set Document IDs'));

    contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );
    expect(contextValue.documentIds).toEqual(['doc-1', 'doc-2']);
  });

  it('initializes knowledge base IDs from query parameters', () => {
    const mockRouter = {
      isReady: true,
      query: {
        knowledge_base_ids: 'kb1,kb2,kb3',
      },
      push: jest.fn(),
      replace: jest.fn(),
      pathname: '/chat',
      asPath: '/chat',
    };

    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    renderWrapper(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    const contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );

    expect(contextValue.knowledgeBaseIds).toEqual(['kb1', 'kb2', 'kb3']);
  });

  it('initializes document IDs from query parameters', () => {
    const mockRouter = {
      isReady: true,
      query: {
        document_ids: 'doc1,doc2',
      },
      push: jest.fn(),
      replace: jest.fn(),
      pathname: '/chat',
      asPath: '/chat',
    };

    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    renderWrapper(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    const contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );

    expect(contextValue.documentIds).toEqual(['doc1', 'doc2']);
  });

  it('initializes sources sidebar expanded from query parameters', () => {
    const mockRouter = {
      isReady: true,
      query: {
        sources_sidebar_expanded: 'true',
      },
      push: jest.fn(),
      replace: jest.fn(),
      pathname: '/chat',
      asPath: '/chat',
    };

    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    renderWrapper(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    const contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );

    expect(contextValue.sourcesSidebarExpanded).toBe(true);
  });

  it('initializes multiple values from query parameters', () => {
    const mockRouter = {
      isReady: true,
      query: {
        knowledge_base_ids: 'kb1,kb2',
        document_ids: 'doc1,doc2,doc3',
        sources_sidebar_expanded: 'true',
      },
      push: jest.fn(),
      replace: jest.fn(),
      pathname: '/chat',
      asPath: '/chat',
    };

    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    renderWrapper(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    const contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );

    expect(contextValue.knowledgeBaseIds).toEqual(['kb1', 'kb2']);
    expect(contextValue.documentIds).toEqual(['doc1', 'doc2', 'doc3']);
    expect(contextValue.sourcesSidebarExpanded).toBe(true);
  });

  it('filters out empty IDs from query parameters', () => {
    const mockRouter = {
      isReady: true,
      query: {
        knowledge_base_ids: 'kb1,,kb2, ,kb3',
        document_ids: 'doc1, , ,doc2',
      },
      push: jest.fn(),
      replace: jest.fn(),
      pathname: '/chat',
      asPath: '/chat',
    };

    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    renderWrapper(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    const contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );

    expect(contextValue.knowledgeBaseIds).toEqual(['kb1', 'kb2', 'kb3']);
    expect(contextValue.documentIds).toEqual(['doc1', 'doc2']);
  });
});
