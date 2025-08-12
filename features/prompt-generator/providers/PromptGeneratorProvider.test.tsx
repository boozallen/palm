import { render, screen } from '@testing-library/react';

import { PromptGeneratorProvider, usePromptGenerator } from './PromptGeneratorProvider';

// A test component that consumes the PromptGeneratorContext
const TestComponent = () => {
  const { newPrompt, stepper, generateInstructionsPrompt } = usePromptGenerator();
  return (
    <div>
      <div data-testid='title'>{newPrompt.values.title}</div>
      <div data-testid='summary'>{newPrompt.values.summary}</div>
      <div data-testid='config-randomness'>{newPrompt.values.config.randomness}</div>
      <div data-testid='config-repetitiveness'>{newPrompt.values.config.repetitiveness}</div>
      <div data-testid='config-model'>{newPrompt.values.config.model}</div>
      <div data-testid='creatorId'>{String(newPrompt.values.creatorId)}</div>
      <div data-testid='current-step'>{stepper.currentStep}</div>
      <div data-testid='generate-instructions-prompt'>{generateInstructionsPrompt}</div>
    </div>
  );
};

describe('PromptGeneratorProvider', () => {
  it('renders children without error', () => {
    render(
      <PromptGeneratorProvider>
        <div data-testid='child'>Child Component</div>
      </PromptGeneratorProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('provides context value to children', () => {
    render(
      <PromptGeneratorProvider>
        <TestComponent />
      </PromptGeneratorProvider>
    );

    // Check that the initial values from the form are as expected.
    expect(screen.getByTestId('title').textContent).toBe('');
    expect(screen.getByTestId('summary').textContent).toBe('');
    expect(screen.getByTestId('config-randomness').textContent).toBe('0.5');
    expect(screen.getByTestId('config-repetitiveness').textContent).toBe('0.5');
    expect(screen.getByTestId('config-model').textContent).toBe('');
    expect(screen.getByTestId('creatorId').textContent).toBe('null');
    expect(screen.getByTestId('current-step').textContent).toBe('0');
    expect(screen.getByTestId('generate-instructions-prompt').textContent).toBe('');
  });

  it('throws error when using usePromptGenerator outside of provider', () => {
    const originalConsoleError = console.error;
    console.error = jest.fn();

    expect(() => render(<TestComponent />)).toThrow(
      'An unexpected error occurred. Please try again later.'
    );

    console.error = originalConsoleError;
  });
});
