import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChatProvider, useChat } from './ChatProvider';
import { Artifact } from '@/features/chat/types/message';

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
      <button onClick={() => chatContext.setKnowledgeBaseIds(['kb3', 'kb4'])}>
        Set Knowledge Base IDs
      </button>
      <button onClick={() => {
        const artifact: Artifact = {
          id: 'artifact-1',
          fileExtension: 'txt',
          label: 'Test Artifact',
          content: 'This is a test artifact',
          chatMessageId: 'msg-1',
          createdAt: new Date(),
        };
        chatContext.setSelectedArtifact(artifact);
      }}>
        Set Selected Artifact
      </button>
      <button onClick={() => chatContext.setSystemMessage('This is your persona')}>
        Set System Message
      </button>
      <button onClick={() => chatContext.setDocumentLibraryEnabled(true)}>
        Enable Document Library
      </button>
      <button onClick={() => chatContext.setSelectedText('Test selected text')}>
        Set Selected Text
      </button>
    </div>
  );
};

describe('ChatProvider', () => {
  it('provides default values when no props are passed', () => {
    render(
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
    expect(contextValue.knowledgeBaseIds).toEqual([]);
    expect(contextValue.selectedArtifact).toBeNull();
    expect(contextValue.systemMessage).toBeNull();
    expect(contextValue.documentLibraryEnabled).toBe(false);
    expect(contextValue.selectedText).toEqual(null);
  });

  it('provides initial values when props are passed', () => {
    render(
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
    expect(contextValue.documentLibraryEnabled).toBe(false);
  });

  it('updates values when using setter functions', async () => {
    const user = userEvent.setup();
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    await user.click(screen.getByText('Set Chat ID'));
    await user.click(screen.getByText('Set Prompt ID'));
    await user.click(screen.getByText('Set Model ID'));
    await user.click(screen.getByText('Set Pending Message'));
    await user.click(screen.getByText('Set Last Message Retry'));
    await user.click(screen.getByText('Set Knowledge Base IDs'));
    await user.click(screen.getByText('Set Selected Artifact'));
    await user.click(screen.getByText('Set System Message'));
    await user.click(screen.getByText('Enable Document Library'));

    const contextValue = JSON.parse(
      screen.getByTestId('context-value').textContent ?? ''
    );

    expect(contextValue.chatId).toBe('new-chat');
    expect(contextValue.promptId).toBe('new-prompt');
    expect(contextValue.modelId).toBe('new-model');
    expect(contextValue.pendingMessage).toBe('new message');
    expect(contextValue.isLastMessageRetry).toBe(true);
    expect(contextValue.knowledgeBaseIds).toEqual(['kb3', 'kb4']);

    const expectedArtifact: Artifact = {
      id: 'artifact-1',
      fileExtension: 'txt',
      label: 'Test Artifact',
      content: 'This is a test artifact',
      chatMessageId: 'msg-1',
      createdAt: expect.any(String),
    };
    expect(contextValue.selectedArtifact).toMatchObject(expectedArtifact);

    expect(contextValue.systemMessage).toBe('This is your persona');
    expect(contextValue.documentLibraryEnabled).toBe(true);
  });

  it('manages selected text correctly', async () => {
    const user = userEvent.setup();
    render(
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
});
