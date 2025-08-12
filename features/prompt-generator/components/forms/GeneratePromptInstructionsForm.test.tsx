import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TRPCClientError } from '@trpc/client';

import GeneratePromptInstructionsForm from '@/features/prompt-generator/components/forms/GeneratePromptInstructionsForm';
import { usePromptGenerator } from '@/features/prompt-generator/providers';
import { useGenerateInstructionsForm } from '@/features/prompt-generator/hooks';

jest.mock('@/features/prompt-generator/providers');
jest.mock('@/features/prompt-generator/hooks');

let promptSubmissionProps: { message: string, enabled: boolean } | null = null;
jest.mock('@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification', () => {
  return jest.fn((props) => {
    promptSubmissionProps = props;

    return <>Prompt Submission Error Notification</>;
  });
});

const renderComponent = () => {
  return render(
    <GeneratePromptInstructionsForm />
  );
};

const nextStep = jest.fn();
const setGenerateInstructionsPrompt = jest.fn();
const setFieldValue = jest.fn();

const mockUsePromptGenerator = (generateInstructionsPrompt: string = '') => {
  (usePromptGenerator as jest.Mock).mockReturnValue({
    stepper: {
      nextStep,
    },
    generateInstructionsPrompt,
    setGenerateInstructionsPrompt,
    newPrompt: {
      setFieldValue,
    },
  });
};

const mockGenerateInstructions = jest.fn().mockReturnValue('This is a response');
const mockUseGenerateInstructionsForm = (
  overrides: Partial<ReturnType<typeof useGenerateInstructionsForm>> = {},
) => {

  const mockForm = {
    isValid: jest.fn().mockReturnValue(true),
    onSubmit: jest.fn((cb) => (e: React.FormEvent) => {
      e.preventDefault?.();
      return cb({ prompt: 'test prompt' });
    }),
    getInputProps: jest.fn(),
    setFieldValue: jest.fn(),
  };

  (useGenerateInstructionsForm as jest.Mock).mockReturnValue({
    form: mockForm,
    generateInstructions: mockGenerateInstructions,
    isPending: false,
    hasError: false,
    error: null,
    ...overrides,
  });
};

describe('GeneratePromptInstructionsForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePromptGenerator();
    mockUseGenerateInstructionsForm();
  });

  afterEach(() => {
    promptSubmissionProps = null;
  });

  describe('Initialization', () => {
    it('renders example prompt', () => {
      renderComponent();

      const examplePrompt = screen.getByLabelText(/example prompt/i);
      expect(examplePrompt).toBeInTheDocument();
    });

    it('renders textarea', () => {
      renderComponent();

      const textarea = screen.getByLabelText(/generate a prompt for/i);
      expect(textarea).toBeInTheDocument();
    });

    it('calls custom hook with initial prompt', () => {
      const generateInstructionsPrompt = 'Initial prompt';
      mockUsePromptGenerator(generateInstructionsPrompt);

      renderComponent();

      expect(useGenerateInstructionsForm).toHaveBeenCalledWith(generateInstructionsPrompt);
    });

    it('renders submit button', () => {
      renderComponent();

      const submitButton = screen.getByTestId('submit');
      expect(submitButton).toBeInTheDocument();
    });

    it('renders promptSubmissionErrorNotification', () => {
      renderComponent();

      const notification = screen.getByText(/prompt submission error notification/i);
      expect(notification).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('calls generateInstructions when form is submitted', async () => {
      renderComponent();

      const submitButton = screen.getByTestId('submit');
      act(() => fireEvent.submit(submitButton));

      await waitFor(() => {
        expect(mockGenerateInstructions).toHaveBeenCalledWith({ prompt: 'test prompt' });
      });
    });

    it('updates relevant state upon submission', async () => {
      renderComponent();

      const submitButton = screen.getByTestId('submit');

      act(() => fireEvent.submit(submitButton));

      await waitFor(() => {
        expect(setFieldValue).toHaveBeenCalledWith('instructions', 'This is a response');
        expect(setGenerateInstructionsPrompt).toHaveBeenCalledWith('test prompt');
        expect(nextStep).toHaveBeenCalled();
      });
    });

    it('changes button text when pending', () => {
      mockUseGenerateInstructionsForm({ isPending: true });

      renderComponent();

      const submitButton = screen.getByTestId('submit');
      expect(submitButton).toHaveTextContent(/generating/i);
    });

    it('calls PromptSubmissionErrorNotification with error', () => {
      const error = new TRPCClientError('Test error');
      mockUseGenerateInstructionsForm({ hasError: true, error });

      renderComponent();
      const submitButton = screen.getByTestId('submit');
      act(() => fireEvent.submit(submitButton));

      expect(promptSubmissionProps?.message).toEqual(error.message);
      expect(promptSubmissionProps?.enabled).toEqual(true);
    });
  });
});
