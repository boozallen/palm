import { Box, CopyButton, ActionIcon, Tooltip, Text, ThemeIcon, Group, MantineNumberSize } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { Prism } from '@mantine/prism';

import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type CodeBlockWithBannerProps = Readonly<{
  value: string;
  language: string;
  p?: MantineNumberSize;
}>;

export default function CodeBlockWithBanner({ value, language, p = 'md' }: CodeBlockWithBannerProps) {
  const track = useTrackClientEvent();

  return (
    <Box p={p} data-testid='codeblock-with-banner'>
      <Group position='apart' pb='sm'>
        <Text size='xssm' c='gray.8' data-testid={'language-label'}>{language}</Text>
        <CopyButton value={value} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : 'Copy'} position='right'>
              <ActionIcon
                color={copied ? 'teal' : 'gray'}
                onClick={() => {
                  copy();
                  track.copy.content(`${language} code block`);
                }}
                className='codeblock-hover-visible'
                data-testid='codeblock-copy-button'
              >
                <ThemeIcon size={'sm'}>
                  {copied ? <IconCheck stroke={1} /> : <IconCopy stroke={1} />}
                </ThemeIcon>
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Prism
        language={language as any}
        noCopy={true}
        className={`language-${language}`}
        styles={(theme) => ({
          code: {
            paddingLeft: theme.spacing.md,
            paddingRight: theme.spacing.md,
          },
        })}
      >
        {value}
      </Prism>
    </Box>
  );
}
