import { Box, CopyButton, ActionIcon, Tooltip, Text, ThemeIcon, Group } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

type CodeBlockWithBannerProps = Readonly<{
  value: string;
  language: string;
}>;

export default function CodeBlockWithBanner({ value, language }: CodeBlockWithBannerProps) {
  return (
    <Box p='md' data-testid='codeblock-with-banner'>
      <Group position='apart' pb='sm'>
        <Text size='xssm' c='gray.8' data-testid={'language-label'}>{language}</Text>
        <CopyButton value={value} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position='right'>
              <ActionIcon
                color={copied ? 'teal' : 'gray'}
                onClick={copy}
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
      <code className={`language-${language}`}>
        {value}
      </code>
    </Box>
  );
}
