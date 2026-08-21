import { render } from '@testing-library/react';
import { useRouter } from 'next/router';
import { MantineProvider } from '@mantine/core';

import MessageInput from './MessageInput';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { trpc } from '@/libs';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/api/get-feature-flag');
jest.mock('@/features/shared/api/get-available-models');
jest.mock('@/features/chat/providers/ChatProvider');
jest.mock('@/libs', () => ({
  trpc: {
    chat: {
      getMessages: {
        useQuery: jest.fn(),
      },
    },
  },
}));

const renderComponent = (props: any) => {
  return render(
    <MantineProvider>
      <MessageInput {...props} />
    </MantineProvider>
  );
};

describe('MessageInput', () => {
  const mockForm = {
    values: { message: '' },
    getInputProps: jest.fn().mockReturnValue({}),
  };

  const mockUseChat = {
    modelId: 'test-model-id',
    chatId: null,
    selectedArtifact: null,
    selectedText: null,
    setSelectedText: jest.fn(),
    isLastMessageRetry: false,
  };

  const defaultProps = {
    form: mockForm,
    isDisabled: false,
    isPending: false,
    handleSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      replace: jest.fn(),
      push: jest.fn(),
      events: { on: jest.fn(), off: jest.fn() },
    });
    (useChat as jest.Mock).mockReturnValue(mockUseChat);
    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: {
        availableModels: [{
          id: 'test-model-id',
          name: 'Test Model',
        }],
      },
      isPending: false,
    });
    (trpc.chat.getMessages.useQuery as jest.Mock).mockReturnValue({
      data: { messages: [] },
    });
    (useGetFeatureFlag as jest.Mock).mockReturnValue({
      data: { isFeatureOn: true },
      isPending: false,
      error: null,
    });
  });

  it('renders without crashing', () => {
    const { container } = renderComponent(defaultProps);
    expect(container).toBeTruthy();
  });

  it('enables textarea when modelId has agent-provider prefix even with no models available', () => {
    (useChat as jest.Mock).mockReturnValue({
      ...mockUseChat,
      modelId: 'agent-provider::a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    });
    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: { availableModels: [] },
      isPending: false,
    });

    const { getByTestId } = renderComponent(defaultProps);
    const textarea = getByTestId('chat-input-textarea');
    expect(textarea).not.toBeDisabled();
  });

});
