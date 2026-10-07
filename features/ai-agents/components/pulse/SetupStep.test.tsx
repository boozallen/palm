import { render, screen } from '@testing-library/react';

import SetupStep from '@/features/ai-agents/components/pulse/SetupStep';

describe('SetupStep', () => {
  it('shows the step number, title, and instructions', () => {
    render(
      <SetupStep step={3} title='Upload the survey' description='Pick the survey export.' testId='pulse-step-survey'>
        <button type='button' data-testid='inner-button'>go</button>
      </SetupStep>,
    );

    expect(screen.getByTestId('pulse-step-survey-number')).toHaveTextContent('3');
    expect(screen.getByTestId('pulse-step-survey')).toHaveTextContent('Upload the survey');
    expect(screen.getByTestId('pulse-step-survey-description')).toHaveTextContent('Pick the survey export.');
  });

  it('leaves out the instructions when there are none', () => {
    render(
      <SetupStep step={1} title='Get the template' testId='pulse-step-template'>
        <span />
      </SetupStep>,
    );

    expect(screen.queryByTestId('pulse-step-template-description')).not.toBeInTheDocument();
  });

  it('is usable by default', () => {
    render(
      <SetupStep step={1} title='Get the template' testId='pulse-step-template'>
        <button type='button' data-testid='inner-button'>go</button>
      </SetupStep>,
    );

    expect(screen.getByTestId('inner-button')).toBeEnabled();
    expect(screen.queryByTestId('pulse-step-template-disabled-reason')).not.toBeInTheDocument();
  });

  it('disables everything inside a disabled step and says why', () => {
    render(
      <SetupStep step={4} title='Upload the prompt matrix' disabled disabledReason='Choose a model first.' testId='pulse-step-matrix'>
        <button type='button' data-testid='inner-button'>go</button>
        <input data-testid='inner-input' />
      </SetupStep>,
    );

    expect(screen.getByTestId('pulse-step-matrix-body')).toBeDisabled();
    expect(screen.getByTestId('inner-button')).toBeDisabled();
    expect(screen.getByTestId('inner-input')).toBeDisabled();
    expect(screen.getByTestId('pulse-step-matrix-disabled-reason')).toHaveTextContent('Choose a model first.');
  });

  it('gives no reason once the step is enabled, even if one is passed', () => {
    render(
      <SetupStep step={4} title='Upload the prompt matrix' disabled={false} disabledReason='Choose a model first.' testId='pulse-step-matrix'>
        <span />
      </SetupStep>,
    );

    expect(screen.queryByTestId('pulse-step-matrix-disabled-reason')).not.toBeInTheDocument();
  });
});
