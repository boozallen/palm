import { Anchor, Group, TextInput } from '@mantine/core';
import { passwordInputPlaceholder } from '@/features/shared/utils';
import { JSX } from 'react';

type PasswordInputPlaceholderProps = Readonly<{
  handleReplace: () => void;
  label?: string;
}>;

export function PasswordInputPlaceholder({ handleReplace, label='API Key' }: PasswordInputPlaceholderProps): JSX.Element {

  return (
    <Group>
      <TextInput
        label={label}
        disabled={true}
        value={passwordInputPlaceholder}
      />
      <Anchor
        onClick={handleReplace}
        aria-label={`Replace ${label}`}
        data-testid={`replace-${label.toLowerCase().replaceAll(' ', '-')}`}
        component='button'
        type='button'
      >
        Replace
      </Anchor>
    </Group>
  );
}
