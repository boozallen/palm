import { render, screen } from '@testing-library/react';
import CreatePrompt from '@/pages/library/add';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/api/get-feature-flag');

jest.mock('@/features/shared/components/forms/CreatePromptForm', () => {
  return function MockedCreatePromptForm({ prompt }: { prompt: any }) {
    return <div data-testid='create-prompt-form'>{JSON.stringify(prompt)}</div>;
  };
});

describe('CreatePromptPage', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          id: 'user-id',
        },
      },
    });

    (useRouter as jest.Mock).mockReturnValue({
      query: {},
      push: mockPush,
    });

    (useGetFeatureFlag as jest.Mock).mockReturnValue({
      data: true,
      isPending: false,
    });
  });

  it('renders without crashing', () => {
    render(<CreatePrompt />);

    expect(screen.getByText('Add a Prompt')).toBeInTheDocument();
    expect(screen.getByText(/Fill out the form below/)).toBeInTheDocument();
    expect(screen.getByTestId('create-prompt-form')).toBeInTheDocument();
  });

  it('passes empty promptData when no query param is provided', () => {
    render(<CreatePrompt />);
    const formElement = screen.getByTestId('create-prompt-form');
    expect(formElement).toBeInTheDocument();
    expect(formElement.textContent).toBe('{}');
  });

  it('passes correct promptData when query param is provided', () => {
    const testPromptData = { prompt: 'test prompt' };
    (useRouter as jest.Mock).mockReturnValue({
      query: { promptData: encodeURIComponent(JSON.stringify(testPromptData)) },
      push: mockPush,
    });

    render(<CreatePrompt />);
    const formElement = screen.getByTestId('create-prompt-form');
    expect(formElement).toBeInTheDocument();
    expect(formElement.textContent).toBe(JSON.stringify(testPromptData));
  });
});
