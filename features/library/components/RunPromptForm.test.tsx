import { act, render, renderHook, screen } from '@testing-library/react';
import { useForm, zodResolver } from '@mantine/form';

import RunPromptForm from './RunPromptForm';
import { runPromptFormSchema, RunPromptForm as RunPromptFormType } from '@/features/shared/types';
import { usePromptDetails } from '@/features/library/providers/PromptDetailsProvider';

jest.mock('@/features/shared/components/forms/inputs/InstructionsAndParameters', () => {
  return jest.fn(() => <div>Instructions and Parameters</div>);
});

jest.mock('@/features/library/providers/PromptDetailsProvider', () => ({
  usePromptDetails: jest.fn(),
}));

const mockPromptFormSubmission = jest.fn();
jest.mock('@/features/shared/components/forms/PromptFormSubmission', () => {
  return jest.fn((props) => {
    mockPromptFormSubmission(props);
    return <div>Prompt Form Submission</div>;
  });
});

type MockPromptDetailsInput = {
  initialValues: RunPromptFormType;
  response: string;
  isPending: boolean;
  hasError: boolean;
  error: Error | null;
}

describe('RunPromptForm', () => {
  const mockFormValues: RunPromptFormType = {
    example: 'Test Example',
    instructions: 'Test Instructions',
    config: {
      model: 'test-model',
      repetitiveness: 0.5,
      randomness: 0.2,
    },
  };

  const targetRef = jest.fn();
  const handleSubmit = jest.fn();

  const defaultInputs = {
    initialValues: mockFormValues,
    response: '',
    isPending: false,
    hasError: false,
    error: null,
  };

  const mockPromptDetails = ({
    initialValues,
    response,
    isPending,
    hasError,
    error,
  }: MockPromptDetailsInput = defaultInputs) => {

    const returnValue = {
      form: renderHook(() => useForm<RunPromptFormType>({
        initialValues,
        validate: zodResolver(runPromptFormSchema),
      })).result.current,
      response,
      isPending,
      hasError,
      error,
      targetRef,
      handleSubmit,
    };

    (usePromptDetails as jest.Mock).mockReturnValue(returnValue);

    return returnValue;
  };

  const renderRunPromptForm = (props?: Partial<MockPromptDetailsInput>) => {
    mockPromptDetails({ ...defaultInputs, ...props });
    return render(<RunPromptForm />);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls usePromptDetailsHook', () => {
    renderRunPromptForm();
    expect(usePromptDetails).toHaveBeenCalled();
  });

  it('renders example textarea', () => {
    renderRunPromptForm();
    expect(screen.getByLabelText('Prompt example')).toBeInTheDocument();
  });

  it('sets example text area to correct value', () => {
    renderRunPromptForm();
    expect(screen.getByLabelText('Prompt example')).toHaveValue(mockFormValues.example);
  });

  it('renders instructions and parameters', () => {
    renderRunPromptForm();
    expect(screen.getByText('Instructions and Parameters')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    renderRunPromptForm();
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('Run Prompt');
  });

  it('changes text content of submit button if pending', () => {
    renderRunPromptForm({ ...defaultInputs, isPending: true });
    expect(screen.getByRole('button')).toHaveTextContent('Running Prompt');
  });

  it('calls handleSubmit on form submission', () => {
    renderRunPromptForm();

    act(() => {
      screen.getByRole('button').click();
    });

    expect(handleSubmit).toHaveBeenCalled();
  });

  const cases = [
    { description: 'Default Props', props: defaultInputs },
    { description: 'Loading State', props: { ...defaultInputs, isPending: true } },
    { description: 'Response State', props: { ...defaultInputs, response: 'Test Response' } },
    { description: 'Error State', props: { ...defaultInputs, hasError: true, error: new Error('Test Error') } },
  ];
  it.each(cases)('calls prompt form submission with correct props: $description', ({ props }) => {
    renderRunPromptForm({ ...props });

    expect(mockPromptFormSubmission).toHaveBeenCalledWith({
      hasPromptSubmissionError: props.hasError,
      errorMessage: props.error?.message,
      isPending: props.isPending,
      data: props.response,
    });
  });
});
