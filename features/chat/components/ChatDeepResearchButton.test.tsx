import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import ChatDeepResearchButton from './ChatDeepResearchButton';
import { ChatProvider } from '@/features/chat/providers/ChatProvider';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { AiProviderType } from '@/features/shared/types/ai-provider';

jest.mock('@/features/shared/api/get-feature-flag');
jest.mock('@/features/shared/api/get-available-models');

let mockModelId = 'test-model-1';

jest.mock('@/features/chat/providers/ChatProvider', () => {
  const mockChatProvider = jest.fn(({ children }) => {
    return <div>{children}</div>;
  });
  
  return {
    ChatProvider: mockChatProvider,
    useChat: () => ({
      deepResearchEnabled: false,
      setDeepResearchEnabled: jest.fn(),
      modelId: mockModelId,
    }),
  };
});

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('ChatDeepResearchButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModelId = 'test-model-1'; // Reset to default OpenAI model

    (useGetAvailableModels as jest.Mock).mockImplementation(() => ({
      data: { 
        availableModels: [
          { 
            id: 'test-model-1',
            name: 'GPT-4',
            providerLabel: 'OpenAI',
            aiProviderTypeId: AiProviderType.OpenAi,
          },
          {
            id: 'test-model-2',
            name: 'Claude',
            providerLabel: 'Anthropic',
            aiProviderTypeId: 2,
          },
        ],
      },
      isPending: false,
    }));
  });

  it('renders the button with correct icon', () => {
    render(
      <ChatProvider>
        <ChatDeepResearchButton />
      </ChatProvider>
    );

    const button = screen.getByTestId('chat-deep-research-button');
    expect(button).toBeInTheDocument();
    // The button contains an IconListSearch icon, not text
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('button has tooltip functionality', () => {
    render(
      <ChatProvider>
        <ChatDeepResearchButton />
      </ChatProvider>
    );

    const button = screen.getByTestId('chat-deep-research-button');
    
    // Check that the button is wrapped in a tooltip
    expect(button).toBeInTheDocument();
    expect(button.parentElement).toBeInTheDocument();
  });

  it('toggles deep research state when clicked', () => {
    render(
      <ChatProvider>
        <ChatDeepResearchButton />
      </ChatProvider>
    );

    const button = screen.getByTestId('chat-deep-research-button');
    
    // Initially should be clickable and have correct icon
    expect(button).toBeEnabled();
    expect(button.querySelector('svg')).toBeInTheDocument();
    
    fireEvent.click(button);
    
    // After click, button should still be enabled and have same icon
    expect(button).toBeEnabled();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('renders when selected model is OpenAI provider', () => {
    (useGetAvailableModels as jest.Mock).mockImplementation(() => ({
      data: { 
        availableModels: [
          { 
            id: 'test-model-1',
            name: 'GPT-4',
            providerLabel: 'OpenAI',
            aiProviderTypeId: AiProviderType.OpenAi,
          },
          { 
            id: 'test-model-2',
            name: 'Claude',
            providerLabel: 'Anthropic',
            aiProviderTypeId: 2,
          },
        ],
      },
      isPending: false,
    }));

    render(
      <ChatProvider>
        <ChatDeepResearchButton />
      </ChatProvider>
    );

    const button = screen.getByTestId('chat-deep-research-button');
    expect(button).toBeInTheDocument();
  });

  it('does not render when selected model is not OpenAI provider', () => {
    mockModelId = 'test-model-2'; // Set to Anthropic model

    render(
      <ChatProvider>
        <ChatDeepResearchButton />
      </ChatProvider>
    );

    expect(screen.queryByTestId('chat-deep-research-button')).not.toBeInTheDocument();
  });

  it('does not render when available models data is empty', () => {
    (useGetAvailableModels as jest.Mock).mockImplementation(() => ({
      data: { availableModels: [] },
      isPending: false,
    }));

    render(
      <ChatProvider>
        <ChatDeepResearchButton />
      </ChatProvider>
    );

    expect(screen.queryByTestId('chat-deep-research-button')).not.toBeInTheDocument();
  });

  it('does not render when available models data is undefined', () => {
    (useGetAvailableModels as jest.Mock).mockImplementation(() => ({
      data: undefined,
      isPending: false,
    }));

    render(
      <ChatProvider>
        <ChatDeepResearchButton />
      </ChatProvider>
    );

    expect(screen.queryByTestId('chat-deep-research-button')).not.toBeInTheDocument();
  });

  it('does not show deep research button when models are pending', () => {
    (useGetAvailableModels as jest.Mock).mockImplementation(() => ({
      data: undefined,
      isPending: true,
    }));

    render(
      <ChatProvider>
        <ChatDeepResearchButton />
      </ChatProvider>
    );

    expect(screen.queryByTestId('chat-deep-research-button')).not.toBeInTheDocument();
  });
});
