import { Group, Slider, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

type AiConfigSliderProps = Readonly<{
  // UI display props
  label: string;
  description: string;

  // Form control props (from useForm.getInputProps('field'))
  value: number;
  onChange: (value: number) => void;
  onFocus?: any;
  onBlur?: any;
}>

export default function AiConfigSlider({
  label,
  description,
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
        <Tooltip label={description}>
          <ThemeIcon size='xs'>
            <IconInfoCircle />
          </ThemeIcon>
        </Tooltip>
      </Group>
      <Slider
        thumbLabel={label}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </>
  );
}
