import { render, screen } from '@testing-library/react';

import { PromptDetailsProvider, usePromptDetails } from '@/features/library/providers/PromptDetailsProvider';
import { Prompt } from '@/features/shared/types';
import useRunPromptForm from '@/features/library/hooks/useRunPromptForm';

jest.mock('@/features/library/hooks/useRunPromptForm');
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockReturnValue({
    query: { returnedPromptData: 'mock data' },
    replace: jest.fn(),
  }),
}));

// Create a dummy component to consume the context
const ConsumerComponent = () => {
  const { prompt, form, response, isPending, hasError, targetRef, error } = usePromptDetails();

  return (
    <div>
      <p data-testid='prompt-id'>{prompt.id}</p>
      <p data-testid='form'>{JSON.stringify(form)}</p>
      <p data-testid='response'>{JSON.stringify(response)}</p>
      <p data-testid='isLoading'>{isPending.toString()}</p>
      <p data-testid='hasError'>{hasError.toString()}</p>
      <p data-testid='targetRef'>{JSON.stringify(targetRef)}</p>
      <p data-testid='error'>{JSON.stringify(error)}</p>
    </div>
  );
};

describe('PromptDetailsProvider', () => {
  const mockPrompt: Prompt = {
    id: 'test-id',
    creatorId: null,
    title: 'Test Prompt',
    summary: 'Test summary',
    description: 'Test Description',
    instructions: 'Test instructions',
    example: 'Test example',
    tags: [],
    config: {
      randomness: 0.5,
      repetitiveness: 0.5,
      model: 'Test Model',
    },
  };

  const mockRunPromptForm = {
    form: { someFormState: true },
    response: { data: 'mock response' },
    isPending: false,
    hasError: false,
    error: null,
    handleSubmit: jest.fn(),
    targetRef: { current: null },
  };

  beforeEach(() => {
    (useRunPromptForm as jest.Mock).mockReturnValue(mockRunPromptForm);
  });

  it('provides expected context values', () => {
    render(
      <PromptDetailsProvider prompt={mockPrompt}>
        <ConsumerComponent />
      </PromptDetailsProvider>
    );

    expect(screen.getByTestId('prompt-id')).toHaveTextContent('test-id');
    expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    expect(screen.getByTestId('hasError')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('null');
    expect(screen.getByTestId('form')).toHaveTextContent(
      JSON.stringify({ someFormState: true })
    );
    expect(screen.getByTestId('response')).toHaveTextContent(
      JSON.stringify({ data: 'mock response' })
    );
    expect(screen.getByTestId('targetRef')).toHaveTextContent(
      JSON.stringify({ current: null })
    );
  });
});
