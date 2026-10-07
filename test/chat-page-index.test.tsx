import { render, screen } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';

import ChatInterface from '@/features/chat/components/ChatInterface';
import Conversation from '@/pages/chat/index';

let capturedChatInterfaceProps = {};

jest.mock('next/navigation');

jest.mock('@/features/chat/components/ChatInterface', () => {
  const mockChatInterface = jest.fn((props) => {
    capturedChatInterfaceProps = { ...props };
    return <div>Chat Interface</div>;
  });
  return mockChatInterface;
});

describe('/pages/chat/index.tsx', () => {
  const getSearchParams = jest.fn();
  capturedChatInterfaceProps = {};

  beforeEach(() => {
    jest.clearAllMocks();

    (useSearchParams as jest.Mock).mockReturnValue({
      get: getSearchParams,
    });
  });

  it('renders chat interface component', () => {
    render(<Conversation />);

    expect(screen.getByText('Chat Interface')).toBeInTheDocument();
  });

  it('calls chat interface with valid prompt id', () => {
    const mockPromptId = '0ab24eaa-a05f-4fcc-8963-16971cf8cfeb';
    getSearchParams.mockReturnValue(mockPromptId);

    render(<Conversation />);

   expect(ChatInterface).toHaveBeenCalled();
    
    expect(capturedChatInterfaceProps).toEqual(
      expect.objectContaining({ 
        promptId: mockPromptId,
      })
    );
  });

  it('calls chat interface with null prompt id', () => {
    getSearchParams.mockReturnValue(null);

    render(<Conversation />);

    expect(ChatInterface).toHaveBeenCalled();
    
    expect(capturedChatInterfaceProps).toEqual(
      expect.objectContaining({ 
        promptId: null,
      })
    );
  });
});
