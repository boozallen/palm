import { Group, Slider, Text } from '@mantine/core';

import InfoPopover from '@/features/shared/components/elements/InfoPopover';

type AiConfigSliderProps = Readonly<{
  // UI display props
  label: string;

  // Slider range props
  min?: number;
  max?: number;
  step?: number;

  // Form control props (from useForm.getInputProps('field'))
  value: number;
  onChange: (value: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}>

export default function AiConfigSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  onFocus,
  onBlur,
}: AiConfigSliderProps) {
  return (
    <>
      <Group spacing='xs'>
        <Text variant='slider_label'>
          {label} ({value})
        </Text>
        <InfoPopover label={label} />
      </Group>
      <Slider
        thumbLabel={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </>
  );
}
