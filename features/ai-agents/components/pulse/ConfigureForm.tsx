import { Text, Textarea } from '@mantine/core';

import SetupStep from '@/features/ai-agents/components/pulse/SetupStep';
import type { PulseJobConfig } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import { MAX_RESULTS_FOCUS_LENGTH } from '@/features/ai-agents/utils/pulse/fieldSchema';

// The setup values Agent keeps. The model is chosen in its own step (step 2), so this form
// renders only the persona and the results focus and passes modelId through unchanged.
export type PulseConfigureValues = Pick<PulseJobConfig, 'persona' | 'resultsFocus'> & {
  modelId: string;
};

type ConfigureFormProps = Readonly<{
  values: PulseConfigureValues;
  errors: Record<string, string>;
  disabled: boolean;
  disabledReason: string | null;
  onChange: (values: PulseConfigureValues) => void;
}>;

export default function ConfigureForm({
  values,
  errors,
  disabled,
  disabledReason,
  onChange,
}: ConfigureFormProps) {
  const update = (patch: Partial<PulseConfigureValues>) => {
    onChange({ ...values, ...patch });
  };

  const focusLength = values.resultsFocus?.length ?? 0;

  return (
    <>
      <SetupStep
        step={5}
        title='Persona'
        description='Who the model should be while reading these responses. Required.'
        disabled={disabled}
        disabledReason={disabledReason}
        testId='pulse-step-persona'
      >
        <Textarea
          data-testid='pulse-persona'
          aria-label='Persona'
          minRows={3}
          autosize
          value={values.persona}
          onChange={(event) => update({ persona: event.currentTarget.value })}
        />
        {errors.persona && (
          <Text data-testid='pulse-error-persona' size='sm' c='red.6'>{errors.persona}</Text>
        )}
      </SetupStep>

      <SetupStep
        step={6}
        title='Additional instructions'
        description='Steers the results dashboard, executive summary, and slides. It does not change how each response is read.'
        disabled={disabled}
        disabledReason={disabledReason}
        testId='pulse-step-results-focus'
      >
        <Textarea
          data-testid='pulse-results-focus'
          label='What should the results emphasize?'
          labelProps={{ 'data-testid': 'pulse-results-focus-label' }}
          minRows={2}
          autosize
          maxLength={MAX_RESULTS_FOCUS_LENGTH}
          value={values.resultsFocus ?? ''}
          onChange={(event) => {
            const text = event.currentTarget.value;
            update({ resultsFocus: text.trim().length === 0 ? null : text });
          }}
        />
        <Text data-testid='pulse-results-focus-count' size='xs' c='gray.5'>
          {`${focusLength.toLocaleString('en-US')} / ${MAX_RESULTS_FOCUS_LENGTH.toLocaleString('en-US')}`}
        </Text>
        {errors.resultsFocus && (
          <Text data-testid='pulse-error-results-focus' size='sm' c='red.6'>{errors.resultsFocus}</Text>
        )}
      </SetupStep>
    </>
  );
}
