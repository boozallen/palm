import { render, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/router';
import StartChatIcon from '@/components/elements/StartChatIcon';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('StartChatIcon', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('renders without crashing', () => {
    const { container } = render(<StartChatIcon id='test' />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('navigates to chat on click', () => {
    const { getByTestId } = render(<StartChatIcon id='test' />);
    fireEvent.click(getByTestId('StartChatIcon'));
    expect(mockRouter.push).toHaveBeenCalledWith('/chat?promptid=test');
  });

  it('navigates to chat on enter key press', () => {
    const { getByTestId } = render(<StartChatIcon id='test' />);
    fireEvent.keyDown(getByTestId('StartChatIcon'), { key: 'Enter', code: 'Enter' });
    expect(mockRouter.push).toHaveBeenCalledWith('/chat?promptid=test');
  });
});
