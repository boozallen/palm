import { useState } from 'react';

import { MAX_STEPS } from '@/features/prompt-generator/utils';

export type UsePromptGeneratorStepperReturnType = {
  currentStep: number;
  nextStep: () => void;
  previousStep: () => void;
};

/**
 * A custom hook used to navigate between steps in the prompt generator.
 *
 * This hook:
 * 1. Initializes the current step to a defined starting value (`0`).
 * 2. Provides a function (`nextStep`) to advance to the next step, ensuring that the step does not exceed the maximum limit (`MAX_STEPS - 1`).
 * 3. Provides a function (`previousStep`) to go back to the previous step, ensuring that the step does not go below the initial step.
 *
 * @returns An object containing:
 *   - `currentStep`: The current step index (a number).
 *   - `nextStep`: A function to increment the current step.
 *   - `previousStep`: A function to decrement the current step.
 */
export function usePromptGeneratorStepper(): UsePromptGeneratorStepperReturnType {
  const [currentStep, setCurrentStep] = useState<number>(0);

  function nextStep() {
    if (currentStep < MAX_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    }
  }

  function previousStep() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  return {
    currentStep,
    nextStep,
    previousStep,
  };
}
