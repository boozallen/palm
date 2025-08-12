import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';

import { usePromptDetails } from '@/features/library/providers/PromptDetailsProvider';
import SaveCustomizedPromptButton from './SaveCustomizedPromptButton';

jest.mock('@/features/library/providers/PromptDetailsProvider');
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

function createPromptWithInstructions(instructions: string) {
  return {
    instructions,
    title: 'Test Title',
    summary: 'Test Summary',
    description: 'Test Description',
    example: 'Test Example',
    tags: ['tag1', 'tag2'],
  };
}

function createFormWithInstructions(instructions: string) {
  return {
    values: {
      instructions,
      config: {
        randomness: 0.5,
        repetitiveness: 0.2,
        model: 'test-model',
      },
    },
  };
}

describe('SaveCustomizedPromptButton', () => {
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      push,
      asPath: '/library/test-path',
    });

    (usePromptDetails as jest.Mock).mockReturnValue({
      form: createFormWithInstructions('Test Instructions'),
      prompt: createPromptWithInstructions('Test Instructions'),
    });
  });

  it('renders button', () => {
    render(<SaveCustomizedPromptButton />);

    const button = screen.getByRole('button', { name: /Save Customized Prompt/i });
    expect(button).toBeInTheDocument();
  });

  it('disables button if the prompt and form have same instructions', () => {
    render(<SaveCustomizedPromptButton />);

    const button = screen.getByRole('button', { name: /Save Customized Prompt/i });
    expect(button).toBeDisabled();
  });

  it('disables button if there are no instructions in form', () => {
    (usePromptDetails as jest.Mock).mockReturnValue({
      form: createFormWithInstructions(''),
      prompt: createPromptWithInstructions('Test Instructions'),
    });

    render(<SaveCustomizedPromptButton />);

    const button = screen.getByRole('button', { name: /Save Customized Prompt/i });
    expect(button).toBeDisabled();
  });

  it('enables form if prompt and form have different instructions', () => {
    (usePromptDetails as jest.Mock).mockReturnValue({
      form: createFormWithInstructions('Custom Instructions'),
      prompt: createPromptWithInstructions('Test Instructions'),
    });

    render(<SaveCustomizedPromptButton />);

    const button = screen.getByRole('button', { name: /Save Customized Prompt/i });
    expect(button).not.toBeDisabled();
  });

  it('navigates to create prompt page with correct data when button is clicked', () => {
    const form = createFormWithInstructions('Custom Instructions');
    const prompt = createPromptWithInstructions('Test Instructions');

    (usePromptDetails as jest.Mock).mockReturnValue({
      form,
      prompt,
    });

    render(<SaveCustomizedPromptButton />);

    const button = screen.getByRole('button', { name: /Save Customized Prompt/i });
    button.click();

    expect(push).toHaveBeenCalledWith({
      pathname: '/library/add',
      query: {
        promptData: JSON.stringify({
          instructions: form.values.instructions,
          config: form.values.config,
          title: prompt.title,
          summary: prompt.summary,
          description: prompt.description,
          example: prompt.example,
          tags: prompt.tags,
        }),
        fromLibrary: true,
        originalPath: '/library/test-path',
      },
    });
  });
});
