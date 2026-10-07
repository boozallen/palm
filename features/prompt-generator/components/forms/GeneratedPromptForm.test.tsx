import { createRef } from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';

import GeneratedPromptForm from '@/features/prompt-generator/components/forms/GeneratedPromptForm';
import useRunPromptForm from '@/features/library/hooks/useRunPromptForm';
import { usePromptGenerator } from '@/features/prompt-generator/providers';
import { usePiiDetection } from '@/features/shared/hooks/piiDetection/usePiiDetection';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

// Mock external hooks and components
jest.mock('@/features/library/hooks/useRunPromptForm');
jest.mock('@/features/prompt-generator/providers');
jest.mock('@/features/shared/hooks/piiDetection/usePiiDetection', () => ({
  usePiiDetection: jest.fn(),
}));
jest.mock('@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution', () => ({
  useUserGroupAttribution: jest.fn(),
}));
jest.mock('@/features/shared/components/forms/inputs/InstructionsAndParameters', () => {
  return jest.fn(() => <div>Instructions and Parameters</div>);
});
jest.mock('@/features/prompt-generator/components/buttons/BackButton', () => {
  return jest.fn(({ onClick }: { onClick: () => void }) => {
    return (
      <button data-testid='back-button' type='button' onClick={onClick}>
        Back
      </button>
    );
  });
});
jest.mock('@/features/prompt-generator/components/buttons/ContinueButton', () => {
  return jest.fn(({ onClick }: { onClick: () => void }) => {
    return (
      <button data-testid='continue-button' type='button' onClick={onClick}>
        Continue
      </button>
    );
  });
});
const mockPromptFormSubmission = jest.fn();
jest.mock('@/features/shared/components/forms/PromptFormSubmission', () => {
  return jest.fn((props) => {
    mockPromptFormSubmission(props);
    return <div>Prompt Form Submission</div>;
  });
});

describe('GeneratedPromptForm', () => {
  const mockFormValues = {
    example: 'Test Example',
    instructions: 'Test Instructions',
    config: { model: 'test-model', temperature: 0.2, topP: 0.5 },
  };
  const handleSubmit = jest.fn();
  const previousStep = jest.fn();
  const nextStep = jest.fn();

  // Base stub for useRunPromptForm
  const baseStub = {
    form: {
      values: mockFormValues,
      isValid: jest.fn().mockReturnValue(true),
      getInputProps: jest.fn().mockReturnValue({}),
      onSubmit: jest.fn(cb => (e?: React.FormEvent) => {
        e?.preventDefault?.();
        return cb(mockFormValues);
      }),
    },
    handleSubmit,
    targetRef: createRef<HTMLDivElement>(),
    isPending: false,
    hasError: false,
    error: null,
    response: null,
  };

  const mockPiiDetection = () => {
    (usePiiDetection as jest.Mock).mockReturnValue({
      submitWithPiiCheck: jest.fn(),
      isModalOpen: false,
      detectedPii: [],
      onContinue: jest.fn(),
      onClose: jest.fn(),
      isProcessing: false,
    });
  };

  const mockUserGroupAttribution = () => {
    (useUserGroupAttribution as jest.Mock).mockReturnValue({
      gate: jest.fn(async (_modelId, onSubmit) => {
        await onSubmit(undefined);
        return true;
      }),
      pendingDecision: null,
      defaultUserGroupId: undefined,
      setDefaultUserGroupId: jest.fn(),
      onSelect: jest.fn(),
      onDismiss: jest.fn(),
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default stub
    (useRunPromptForm as jest.Mock).mockReturnValue(baseStub);
    (usePromptGenerator as jest.Mock).mockReturnValue({
      newPrompt: { values: mockFormValues, setValues: jest.fn() },
      stepper: { previousStep, nextStep },
    });
    mockPiiDetection();
    mockUserGroupAttribution();
  });

  it('renders components', () => {
    render(<GeneratedPromptForm />);

    expect(screen.getByTestId('back-button')).toBeInTheDocument();
    expect(screen.getByLabelText('Test the Generated Prompt')).toBeInTheDocument();
    expect(screen.getByText('Instructions and Parameters')).toBeInTheDocument();
    expect(screen.getByTestId('submit')).toBeInTheDocument();
    expect(screen.getByText('Prompt Form Submission')).toBeInTheDocument();
    expect(screen.getByTestId('continue-button')).toBeInTheDocument();
  });

  it('changes submit button text when loading', () => {
    (useRunPromptForm as jest.Mock).mockReturnValue({ ...baseStub, isPending: true });

    render(<GeneratedPromptForm />);

    expect(screen.getByTestId('submit')).toHaveTextContent('Running Prompt');
  });

  const cases = [
    { description: 'Default Props', stub: baseStub },
    { description: 'Loading State', stub: { ...baseStub, isPending: true } },
    { description: 'Response State', stub: { ...baseStub, response: 'Test Response' } },
    { description: 'Error State', stub: { ...baseStub, hasError: true, error: new Error('Test Error') } },
  ];
  it.each(cases)('calls prompt form submission with correct props: $description', ({ stub }) => {
    (useRunPromptForm as jest.Mock).mockReturnValue(stub);

    render(<GeneratedPromptForm />);

    expect(mockPromptFormSubmission).toHaveBeenCalledWith({
      hasPromptSubmissionError: stub.hasError,
      errorMessage: stub.error?.message,
      isPending: stub.isPending,
      data: stub.response,
    });
  });

  it('goes to previous step when back button is clicked', () => {
    render(<GeneratedPromptForm />);

    fireEvent.click(screen.getByTestId('back-button'));

    expect(previousStep).toHaveBeenCalled();
  });

  it('goes to next step when continue button is clicked', () => {
    render(<GeneratedPromptForm />);

    fireEvent.click(screen.getByTestId('continue-button'));

    expect(nextStep).toHaveBeenCalled();
  });

  it('passes the resolved group attribution choice to handleSubmit', async () => {
    (usePiiDetection as jest.Mock).mockReturnValue({
      submitWithPiiCheck: jest.fn((message, callback) => callback()),
      isModalOpen: false,
      detectedPii: [],
      onContinue: jest.fn(),
      onClose: jest.fn(),
      isProcessing: false,
    });
    (useUserGroupAttribution as jest.Mock).mockReturnValue({
      gate: jest.fn(async (_modelId, onSubmit) => {
        await onSubmit('group-1');
        return true;
      }),
      pendingDecision: null,
      defaultUserGroupId: undefined,
      setDefaultUserGroupId: jest.fn(),
      onSelect: jest.fn(),
      onDismiss: jest.fn(),
    });

    render(<GeneratedPromptForm />);

    await act(async () => {
      fireEvent.submit(screen.getByTestId('submit'));
    });

    expect(handleSubmit).toHaveBeenCalledWith(mockFormValues, 'group-1');
  });

  it('does not call handleSubmit if group attribution is dismissed', async () => {
    (usePiiDetection as jest.Mock).mockReturnValue({
      submitWithPiiCheck: jest.fn((message, callback) => callback()),
      isModalOpen: false,
      detectedPii: [],
      onContinue: jest.fn(),
      onClose: jest.fn(),
      isProcessing: false,
    });
    (useUserGroupAttribution as jest.Mock).mockReturnValue({
      gate: jest.fn().mockResolvedValue(false),
      pendingDecision: null,
      defaultUserGroupId: undefined,
      setDefaultUserGroupId: jest.fn(),
      onSelect: jest.fn(),
      onDismiss: jest.fn(),
    });

    render(<GeneratedPromptForm />);

    await act(async () => {
      fireEvent.submit(screen.getByTestId('submit'));
    });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('updates form when going to next step', () => {
    render(<GeneratedPromptForm />);

    fireEvent.click(screen.getByTestId('continue-button'));

    expect(usePromptGenerator().newPrompt.setValues).toHaveBeenCalledWith({
      ...mockFormValues,
      ...mockFormValues,
    });
  });
});
