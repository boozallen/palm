import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ConfigureForm, { type PulseConfigureValues } from '@/features/ai-agents/components/pulse/ConfigureForm';
import { MAX_RESULTS_FOCUS_LENGTH } from '@/features/ai-agents/utils/pulse/fieldSchema';

const values: PulseConfigureValues = {
  modelId: 'claude-opus-5',
  persona: 'You are a survey analyst.',
  resultsFocus: null,
};

function renderForm(overrides: Partial<React.ComponentProps<typeof ConfigureForm>> = {}) {
  const props = {
    values,
    errors: {} as Record<string, string>,
    disabled: false,
    disabledReason: null as string | null,
    onChange: jest.fn(),
    ...overrides,
  };

  render(<ConfigureForm {...props} />);

  return props;
}

describe('ConfigureForm', () => {
  it('renders the persona and results focus as steps 5 and 6', () => {
    renderForm();

    expect(screen.getByTestId('pulse-step-persona-number')).toHaveTextContent('5');
    expect(screen.getByTestId('pulse-step-results-focus-number')).toHaveTextContent('6');
    expect(screen.getByTestId('pulse-persona')).toHaveValue('You are a survey analyst.');
    expect(screen.getByTestId('pulse-results-focus')).toHaveValue('');
  });

  it('asks what the results should emphasize', () => {
    renderForm();

    expect(screen.getByTestId('pulse-results-focus-label')).toHaveTextContent('What should the results emphasize?');
  });

  it('caps the results focus at 1,000 characters', () => {
    renderForm();

    expect(MAX_RESULTS_FOCUS_LENGTH).toBe(1000);
    expect(screen.getByTestId('pulse-results-focus')).toHaveAttribute('maxLength', '1000');
  });

  it('shows how much of the results focus limit is used', () => {
    renderForm({ values: { ...values, resultsFocus: 'Regional gaps' } });

    expect(screen.getByTestId('pulse-results-focus-count')).toHaveTextContent('13 / 1,000');
  });

  it('has no model select and no response guidelines', () => {
    renderForm();

    expect(screen.queryByTestId('pulse-model')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pulse-response-guidelines')).not.toBeInTheDocument();
  });

  it('has no run button of its own', () => {
    renderForm();

    expect(screen.queryByTestId('pulse-submit')).not.toBeInTheDocument();
  });

  it('reports an edited persona', async () => {
    const props = renderForm();

    await userEvent.type(screen.getByTestId('pulse-persona'), '!');

    expect(props.onChange).toHaveBeenLastCalledWith({ ...values, persona: 'You are a survey analyst.!' });
  });

  it('reports an edited results focus', async () => {
    const props = renderForm();

    await userEvent.type(screen.getByTestId('pulse-results-focus'), 'R');

    expect(props.onChange).toHaveBeenLastCalledWith({ ...values, resultsFocus: 'R' });
  });

  it('stores a blank results focus as nothing rather than an empty string', async () => {
    const props = renderForm({ values: { ...values, resultsFocus: 'Regional gaps' } });

    await userEvent.clear(screen.getByTestId('pulse-results-focus'));

    expect(props.onChange).toHaveBeenLastCalledWith({ ...values, resultsFocus: null });
  });

  it('shows the persona error', () => {
    renderForm({ errors: { persona: 'Describe who the model should be.' } });

    expect(screen.getByTestId('pulse-error-persona')).toHaveTextContent('Describe who the model should be.');
  });

  it('shows the results focus error', () => {
    renderForm({ errors: { resultsFocus: 'Keep the results focus under 1,000 characters.' } });

    expect(screen.getByTestId('pulse-error-results-focus')).toHaveTextContent('1,000');
  });

  it('disables both steps and says why until a model is chosen', () => {
    renderForm({ disabled: true, disabledReason: 'Choose a model first.' });

    expect(screen.getByTestId('pulse-persona')).toBeDisabled();
    expect(screen.getByTestId('pulse-results-focus')).toBeDisabled();
    expect(screen.getByTestId('pulse-step-persona-disabled-reason')).toBeInTheDocument();
    expect(screen.getByTestId('pulse-step-results-focus-disabled-reason')).toBeInTheDocument();
  });
});
