import { ActionIcon, ThemeIcon, Tooltip } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { MouseEventHandler } from 'react';

type PromptTagSuggestionIconProps = {
  onClick: MouseEventHandler<HTMLButtonElement>
  isLoading: boolean;
  enabled: boolean | number;
}
export default function PromptTagSuggestionIcon({ onClick, isLoading, enabled }: PromptTagSuggestionIconProps) {
  const toolTipText = enabled ?
    'Generate a list of recommended tags based on the content of your prompt' :
    'Complete all form fields to generate tag suggestions';

  return (
    <Tooltip
      label={toolTipText}
      openDelay={500}
      events={{ hover: true, focus: true, touch: false }}
      disabled={isLoading}
    >
      <ThemeIcon mb='xs'>
        <ActionIcon
          onClick={onClick}
          disabled={!enabled}
          variant='sparkles_icon'
          loading={isLoading}
          loaderProps={{ color: 'blue' }}
          data-testid='prompt-tag-suggestion-icon'
          aria-label='Generate prompt tag suggestions'
        >
          <IconSparkles />
        </ActionIcon>
      </ThemeIcon>
    </Tooltip>
  );
}

