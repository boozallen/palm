import { ActionIcon, ThemeIcon, Tooltip } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { MouseEventHandler } from 'react';

type RequirementsGenerationIconProps = Readonly<{
  onClick: MouseEventHandler<HTMLButtonElement>;
  isLoading: boolean;
  disabled?: boolean;

}>;

export default function RequirementsGenerationIcon({
  onClick,
  isLoading,
  disabled = false,
}: RequirementsGenerationIconProps) {
  return (
    <Tooltip
      label={'Generate requirements from policy content'}
      openDelay={500}
      events={{ hover: true, focus: true, touch: false }}
      disabled={isLoading}
    >
      <ThemeIcon mb='sm' mt='lg'>
        <ActionIcon
          onClick={onClick}
          disabled={disabled}
          variant='sparkles_icon'
          loading={isLoading}
          loaderProps={{ color: 'blue' }}
          data-testid='generate-requirements-icon'
          aria-label='Generate requirements'
        >
          <IconSparkles />
        </ActionIcon>
      </ThemeIcon>
    </Tooltip>
  );
}
