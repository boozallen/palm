import ChatWidget from './ChatWidget';
import { fireEvent, render } from '@testing-library/react';
import { useRouter } from 'next/router';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('ChatWidget', () => {

  const router = (useRouter as jest.Mock).mockReturnValue({
    route: '/',
    pathname: '',
    push: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();

  });

  it('renders New Conversation button', () => {
    const { getByRole } = render(<ChatWidget />);
    const newConversationButton = getByRole('button');
    expect(newConversationButton).toBeInTheDocument();
    expect(newConversationButton.textContent).toEqual('New Conversation');
  });

  it('New Conversation button navigates to /chat', () => {
    const { getByText } = render(<ChatWidget />);
    const button = getByText('New Conversation');
    fireEvent.click(button);
    expect(router().push).toHaveBeenCalledWith('/chat');
  });

  });
