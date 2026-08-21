import { act, renderHook } from '@testing-library/react';

import { usePromptGeneratorStepper, UsePromptGeneratorStepperReturnType } from './usePromptGeneratorStepper';
import { MAX_STEPS } from '@/features/prompt-generator/utils';

describe('usePromptGeneratorStepper', () => {

  let hook: {
    current: UsePromptGeneratorStepperReturnType;
  };

  beforeEach(() => {
    hook = renderHook(usePromptGeneratorStepper).result;
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  it('sets the first step to 0', () => {
    expect(hook.current.currentStep).toEqual(0);
  });

  it('increases the step when nextStep is called', () => {
    act(hook.current.nextStep);
    expect(hook.current.currentStep).toBe(0 + 1);
  });

  it('does not increase the step beyond MAX_STEPS - 1', () => {
    // Move to the last step
    let counter = 0;
    while (counter < MAX_STEPS) {
      act(hook.current.nextStep);
      counter++;
    }

    // Attempt to call nextStep again
    expect(hook.current.currentStep).toBe(MAX_STEPS - 1); // Ensure it is at max step
    act(hook.current.nextStep);

    // Expect currentStep to still be at MAX_STEPS - 1
    expect(hook.current.currentStep).toBe(MAX_STEPS - 1);
  });

  it('does not decrease beyond 0', () => {
    act(hook.current.previousStep);
    expect(hook.current.currentStep).toBe(0); // Ensure it does not go below 0
  });
});
