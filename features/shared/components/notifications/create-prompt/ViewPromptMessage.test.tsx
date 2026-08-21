import { render, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/router';
import { ViewPromptMessage } from './ViewPromptMessage';
import { generatePromptUrl } from '@/features/shared/utils/prompt-helpers';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('ViewPromptMessage', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the error message when viewPromptMessage is not provided', () => {
    const { getByText } = render(<ViewPromptMessage title='' promptId='1' notificationId='' />);
    expect(getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should render the error message when viewPromptMessage is not provided', () => {
    const { getByText } = render(<ViewPromptMessage title='Test' promptId='' notificationId='' />);
    expect(getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should render the success message and button when viewPromptMessage and viewPromptMessage are provided', () => {
    const { getByText } = render(<ViewPromptMessage title='Test' promptId='1' notificationId='' />);
    expect(getByText('You can now view your prompt in the prompt library')).toBeInTheDocument();
    expect(getByText('View Prompt')).toBeInTheDocument();
  });

  it('should navigate to the prompt URL when the button is clicked', () => {
    const { getByText } = render(<ViewPromptMessage title='Test' promptId='1' notificationId='' />);
    fireEvent.click(getByText('View Prompt'));
    expect(mockRouter.push).toHaveBeenCalledWith(generatePromptUrl('Test', '1'));
  });
});
