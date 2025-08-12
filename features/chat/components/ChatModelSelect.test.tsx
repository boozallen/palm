import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ChatModelSelect from './ChatModelSelect';
import { ChatProvider } from '@/features/chat/providers/ChatProvider';
import useGetAvailableModels from '@/features/shared/api/get-available-models';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/features/shared/api/get-available-models');

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

    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: mockAvailableModels,
      isPending: false,
      isError: false,
      error: null,
    });

  });
  it('renders and can change selection', async () => {
    render(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    const selectElement = screen.queryByTestId('model-select');
    expect(selectElement).toBeInTheDocument();
    expect(selectElement).toBeEnabled();
  });

  it('disables the Select component when chatId is provided', async () => {
    render(
      <ChatProvider chatId={'some-chat-id'}>
        <ChatModelSelect />
      </ChatProvider>
    );

    const selectElement = screen.getByTestId('model-select');
    expect(selectElement).toBeDisabled();
  });

  it('does focus on Select component when models are available', async () => {
    render(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    await waitFor(() => {
      const inputElement = screen.getByTestId('model-select');
      expect(inputElement).toHaveFocus();
    });
  });

  it('does not focus on Select component when no models are available', async () => {
    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: { availableModels: [] },
      isPending: false,
      isError: false,
      error: null,
    });
    render(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    await waitFor(() => {
      const inputElement = screen.getByTestId('model-select');
      expect(inputElement).not.toHaveFocus();
    });
  });

  it('opens the Select component automatically when models are available', async () => {
    render(
      <ChatProvider>
        <ChatModelSelect />
      </ChatProvider>
    );

    await waitFor(() => {
      const modelOption1 = screen.getByText('someModelName');
      const modelOption2 = screen.getByText('anotherModel');

      expect(modelOption1).toBeInTheDocument();
      expect(modelOption2).toBeInTheDocument();
    });
  });
});
