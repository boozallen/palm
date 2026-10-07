import { Avatar, ThemeIcon } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';

export function UserAvatar() {
  return (
    <Avatar
      variant={'filled'}
      color={'gray.6'}
      p='xs'
      m={0}
      radius='xl'
    >
      <ThemeIcon c='dark.6'>
        <IconUser
          stroke={2}
          data-testid='icon-user'
        />
      </ThemeIcon>
    </Avatar>
  );
}
