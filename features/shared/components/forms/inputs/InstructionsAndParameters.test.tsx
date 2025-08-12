import { act, render, renderHook, screen } from '@testing-library/react';
import { useForm, UseFormReturnType, zodResolver } from '@mantine/form';

import { RunPromptForm, runPromptFormSchema } from '@/features/shared/types';
import InstructionsAndParameters from './InstructionsAndParameters';

jest.mock('./AiConfigSlider', () => {
  return jest.fn(() => {
    return <div>AiConfigSlider</div>;
  });
});

jest.mock('./ModelSelect', () => {
  return jest.fn(() => {
    return <div>ModelSelect</div>;
  });
});

describe('InstructionsAndParameters', () => {
  let mockForm: UseFormReturnType<RunPromptForm>;
  let mockPrompt = {
    example: 'Test example',
    instructions: 'Test Instructions',
    config: {
      model: 'GPT 4o',
      randomness: 0.5,
      repetitiveness: 0.5,
    },
  };

  beforeEach(() => {
    mockForm = renderHook(() => useForm<RunPromptForm>({
      initialValues: mockPrompt,
      validate: zodResolver(runPromptFormSchema),
    })).result.current;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders accordion', () => {
    render(
      <InstructionsAndParameters
        form={mockForm}
      />
    );
    expect(screen.getByText('Instructions and parameters')).toBeInTheDocument();
  });

  it('renders instructions textarea', () => {
    render(
      <InstructionsAndParameters
        form={mockForm}
      />
    );

    const instructions = screen.getByPlaceholderText(/instructions here/);

    expect(instructions).toBeInTheDocument();
  });

  it('sets correct value for instructions', () => {
    render(
      <InstructionsAndParameters
        form={mockForm}
      />
    );

    const instructions = screen.getByPlaceholderText(/instructions here/);

    expect(instructions).toHaveValue(mockForm.values.instructions);
  });

  it('has accordion open by default', () => {
    render(
      <InstructionsAndParameters
        form={mockForm}
      />
    );

    const instructions = screen.getByPlaceholderText(/instructions here/);

    expect(instructions).toBeVisible();
  });

  it('closes accordion when clicked', () => {
    render(
      <InstructionsAndParameters
        form={mockForm}
      />
    );

    const control = screen.getByText('Instructions and parameters');

    act(() => {
      control.click();
    });

    const instructions = screen.getByPlaceholderText(/instructions here/);

    expect(instructions).not.toBeVisible();
  });

  it('renders two sliders', () => {
    render(
      <InstructionsAndParameters
        form={mockForm}
      />
    );

    const sliders = screen.getAllByText('AiConfigSlider');

    expect(sliders).toHaveLength(2);
    sliders.forEach((slider) => expect(slider).toBeInTheDocument());
  });

  it('renders model select', () => {
    render(
      <InstructionsAndParameters
        form={mockForm}
      />
    );

    expect(screen.getByText('ModelSelect')).toBeInTheDocument();
  });

  it('marks instructions invalid if instructions are missing', () => {
    const invalidForm = renderHook(() => useForm<RunPromptForm>({
      initialValues: { ...mockPrompt, instructions: '' },
      validate: zodResolver(runPromptFormSchema),
    })).result.current;

    render(
      <InstructionsAndParameters
        form={invalidForm}
      />
    );

    const instructions = screen.getByPlaceholderText(/instructions here/);

    expect(instructions).toHaveAttribute('aria-invalid', 'true');
  });
});
