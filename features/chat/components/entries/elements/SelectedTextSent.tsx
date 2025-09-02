import { Group, Text, ThemeIcon } from '@mantine/core';
import { IconCornerDownRight } from '@tabler/icons-react';

type SelectedTextSentProps = Readonly<{
  content: string;
}>;

export default function SelectedTextSent({ content }: SelectedTextSentProps) {
  if (!content) {
    return null;
  }

  return (
    <Group
      mb='sm'
      c='dark.2'
      spacing='xs'
      role='complementary'
      noWrap
    >
      <ThemeIcon variant='noHover' size='xs'>
        <IconCornerDownRight
          aria-hidden='true'
        />
      </ThemeIcon>
      <Text
        fz='xs'
        component='span'
      >
        {content.length > 250 ? `${content.slice(0, 250)}...` : content}
      </Text>
    </Group>
  );
}
