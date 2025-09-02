import { ActionIcon, Paper, Text, Group, ThemeIcon } from '@mantine/core';
import { IconCornerDownRight, IconX } from '@tabler/icons-react';

type SelectedTextProps = Readonly<{
  selectedText: string;
  onRemove: () => void;
}>;

export default function SelectedText({ selectedText, onRemove }: SelectedTextProps) {
  return (
    <Paper
      withBorder
      radius='md'
      p='sm'
      bg='dark.7'
    >
      <Group spacing='sm' noWrap position='apart'>
        <Group spacing='xs' noWrap>
          <ThemeIcon variant='noHover' size='xs'>
            <IconCornerDownRight
              aria-hidden='true'
            />
          </ThemeIcon>
          <Text size='xs'>
            &ldquo;{
            selectedText.length > 250 ?
              `${selectedText.slice(0, 250)}...` :
              selectedText
            }&rdquo;
          </Text>
        </Group>
        <ActionIcon
          size='xs'
          color='blue'
          radius='xl'
          onClick={onRemove}
        >
          <IconX />
        </ActionIcon>
      </Group>
    </Paper>
  );
}
