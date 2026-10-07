import { ActionIcon, Box, Group, Text, ThemeIcon } from '@mantine/core';
import { IconArrowNarrowUp, IconChevronDown, IconMicrophone, IconPlus } from '@tabler/icons-react';
import { ReactNode } from 'react';

type MockChatComposerProps = {
  inputText?: string;
  isPlaceholder?: boolean;
  modelLabel: string;
  highlightModel?: boolean;
  highlightAdd?: boolean;
  attachment?: ReactNode;
  sendEnabled?: boolean;
};

export default function MockChatComposer({
  inputText,
  isPlaceholder = true,
  modelLabel,
  highlightModel = false,
  highlightAdd = false,
  attachment,
  sendEnabled = false,
}: MockChatComposerProps) {
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        position: 'relative',
        borderRadius: 8,
        backgroundColor: theme.colors.dark[5],
        overflow: 'visible',
      })}
    >
      <Box px='md' py='sm' sx={{ minHeight: 44 }}>
        {attachment && <Box mb={6}>{attachment}</Box>}
        <Text
          size='sm'
          sx={(theme) => ({
            color: isPlaceholder ? theme.colors.gray[6] : theme.colors.gray[2],
            minHeight: 20,
          })}
        >
          {inputText}
        </Text>
      </Box>

      <Group
        position='apart'
        px='md'
        pb='sm'
        spacing='sm'
        sx={{ flexWrap: 'nowrap' }}
      >
        <ActionIcon
          variant={highlightAdd ? 'filled' : 'subtle'}
          size='sm'
          color={highlightAdd ? 'orange' : 'gray.5'}
        >
          <IconPlus size={16} />
        </ActionIcon>

        <Group spacing='sm' sx={{ flexWrap: 'nowrap' }}>
          <Group
            spacing={4}
            px={8}
            py={2}
            sx={(theme) => ({
              borderRadius: theme.radius.sm,
              border: `1px solid ${highlightModel ? theme.colors.orange[6] : 'transparent'}`,
              backgroundColor: highlightModel
                ? theme.fn.rgba(theme.colors.orange[6], 0.12)
                : theme.colors.dark[7],
              flexWrap: 'nowrap',
            })}
          >
            <Text
              size='xs'
              sx={(theme) => ({ color: theme.colors.gray[4], whiteSpace: 'nowrap' })}
            >
              {modelLabel}
            </Text>
            <IconChevronDown size={12} color='#909296' />
          </Group>

          <IconMicrophone size={18} color='#909296' />

          <ThemeIcon
            size='sm'
            radius='xl'
            sx={(theme) => ({
              backgroundColor: sendEnabled ? theme.colors.blue[6] : theme.colors.dark[4],
              color: sendEnabled ? theme.white : theme.colors.gray[6],
            })}
          >
            <IconArrowNarrowUp size={16} />
          </ThemeIcon>
        </Group>
      </Group>
    </Box>
  );
}
