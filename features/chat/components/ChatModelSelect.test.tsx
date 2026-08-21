import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';

import ChatModelSelect from './ChatModelSelect';
import { ChatProvider } from '@/features/chat/providers/ChatProvider';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetAvailableAgentProviders from '@/features/shared/api/get-available-agent-providers';
import { useGetUserGraphDatabaseAccess } from '@/features/shared/api/get-user-graph-database-access';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { renderWrapper } from '@/test/test-utils';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/features/shared/api/get-available-models');
jest.mock('@/features/shared/api/get-available-agent-providers');

jest.mock('@/features/shared/components/JoinUserGroupCallout/JoinUserGroupCalloutProvider', () => ({
  useJoinUserGroupCallout: jest.fn(() => ({
    isNonMember: false,
    requestExpandAndFocus: jest.fn(),
  })),
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

describe('ChatAiProviderModelSelect', () => {

  const mockAvailableModels = {
    availableModels: [
      {
        id: 'someModelId',
        name: 'someModelName',
        providerLabel: 'someProviderLabel',
      },
      {
        id: 'anotherModelId',
        name: 'anotherModel',
        providerLabel: 'anotherProviderLabel',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const mockRouter = {
      isReady: true,
      query: {},
      push: jest.fn(),
      replace: jest.fn(),
      pathname: '/chat',
      asPath: '/chat',
    };
    
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: mockAvailableModels,
      isPending: false,
      isError: false,
      error: null,
    });

    (useGetAvailableAgentProviders as jest.Mock).mockReturnValue({
      data: { availableAgentProviders: [] },
    });

    (useGetUserGraphDatabaseAccess as jest.Mock).mockReturnValue({
      data: { hasAccess: true },
      isPending: false,
      isError: false,
      error: null,
    });

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { documentLibraryDocumentUploadProviderId: '' },
      isPending: false,
    });

    (useGetDocuments as jest.Mock).mockReturnValue({
      data: [],
    });

  });
  it('renders and can change selection', async () => {
    renderWrapper(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    const selectElement = screen.queryByTestId('model-select');
    expect(selectElement).toBeInTheDocument();
    expect(selectElement).toBeEnabled();
  });

  it('disables the Select component when chatId is provided', async () => {
    renderWrapper(
      <ChatProvider chatId={'some-chat-id'}>
        <ChatModelSelect />
      </ChatProvider>
    );

    const selectElement = screen.getByTestId('model-select');
    expect(selectElement).toBeDisabled();
  });

  it('does not auto-focus on Select component when models are available', async () => {
    renderWrapper(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    await waitFor(() => {
      const inputElement = screen.getByTestId('model-select');
      expect(inputElement).not.toHaveFocus();
    });
  });

  it('does not focus on Select component when no models are available', async () => {
    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: { availableModels: [] },
      isPending: false,
      isError: false,
      error: null,
    });
    renderWrapper(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    await waitFor(() => {
      const inputElement = screen.getByTestId('model-select');
      expect(inputElement).not.toHaveFocus();
    });
  });

  it('does not automatically open the Select component when models are available', async () => {
    renderWrapper(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    await waitFor(() => {
      const modelOption1 = screen.queryByText('someModelName');
      const modelOption2 = screen.queryByText('anotherModel');

      expect(modelOption1).not.toBeInTheDocument();
      expect(modelOption2).not.toBeInTheDocument();
    });
  });

  it('shows "No models available" placeholder when no models are available', async () => {
    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: { availableModels: [] },
      isPending: false,
      isError: false,
      error: null,
    });

    renderWrapper(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    const selectElement = screen.getByPlaceholderText('No models available');
    expect(selectElement).toBeInTheDocument();
  });

  it('shows "Model unavailable" placeholder when chat has a model that is not in available models', async () => {
    renderWrapper(
      <ChatProvider chatId={'some-chat-id'} modelId={'unavailable-model-id'}>
        <ChatModelSelect />
      </ChatProvider>
    );

    const selectElement = screen.getByPlaceholderText('Model unavailable');
    expect(selectElement).toBeInTheDocument();
  });

  it('shows error message when models API call fails', async () => {
    const errorMessage = 'Failed to load models';
    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      isError: true,
      error: { message: errorMessage },
    });

    renderWrapper(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('disables select when existing chat has available model', async () => {
    renderWrapper(
      <ChatProvider chatId={'some-chat-id'} modelId={'someModelId'}>
        <ChatModelSelect />
      </ChatProvider>
    );

    const selectElement = screen.getByTestId('model-select');
    expect(selectElement).toBeDisabled();
  });

  it('disables select when chat model is unavailable', async () => {
    renderWrapper(
      <ChatProvider chatId={'some-chat-id'} modelId={'unavailable-model-id'}>
        <ChatModelSelect />
      </ChatProvider>
    );

    const selectElement = screen.getByTestId('model-select');
    expect(selectElement).toBeDisabled();
  });

  it('shows "Agent unavailable" placeholder when chat has an agent-provider prefix model not in available options', async () => {
    renderWrapper(
      <ChatProvider chatId={'some-chat-id'} modelId={'agent-provider::some-agent-id'}>
        <ChatModelSelect />
      </ChatProvider>
    );

    const selectElement = screen.getByPlaceholderText('Agent unavailable');
    expect(selectElement).toBeInTheDocument();
  });

  it('enables select for new chat when only agent providers are available', async () => {
    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: { availableModels: [] },
      isPending: false,
      isError: false,
      error: null,
    });
    (useGetAvailableAgentProviders as jest.Mock).mockReturnValue({
      data: { availableAgentProviders: [{ id: 'agent-id-1', name: 'Test Agent' }] },
    });

    renderWrapper(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    const selectElement = screen.getByTestId('model-select');
    expect(selectElement).toBeEnabled();
  });

  it('disables select during loading state when pendingMessage is set', async () => {
    const TestComponent = () => {
      const { setPendingMessage } = require('@/features/chat/providers/ChatProvider').useChat();
      React.useEffect(() => {
        setPendingMessage('Test message');
      }, [setPendingMessage]);
      return <ChatModelSelect />;
    };

    renderWrapper(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    await waitFor(() => {
      const selectElement = screen.getByTestId('model-select');
      expect(selectElement).toBeDisabled();
    });
  });
});
