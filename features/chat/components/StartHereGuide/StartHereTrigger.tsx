import { Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconCompass } from '@tabler/icons-react';

export function StartHereTrigger({
  hasSeen,
  onExpand,
}: {
  hasSeen: boolean;
  onExpand: () => void;
}) {
  return (
    <UnstyledButton
      data-testid='start-here-trigger'
      onClick={onExpand}
      bg='dark.5'
      px='md'
      py='sm'
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        width: '100%',
        borderRadius: theme.radius.md,
        borderTop: `1px solid ${theme.colors.dark[4]}`,
        '&:hover': { backgroundColor: theme.fn.rgba(theme.white, 0.04) },
      })}
    >
      <ThemeIcon
        size='sm'
        radius='sm'
        variant='light'
        c='blue.6'
        sx={(theme) => ({
          backgroundColor: theme.fn.rgba(theme.colors.orange[6], 0.15),
          color: theme.colors.orange[4],
        })}
      >
        <IconCompass size={14} />
      </ThemeIcon>
      <Text size='sm' color='gray.3' sx={{ flex: 1 }}>
        {hasSeen ? 'See what you can do in PALM' : 'Start here — see how it works'}
      </Text>
      <IconChevronRight size={16} color='#909296' />
    </UnstyledButton>
  );
}
