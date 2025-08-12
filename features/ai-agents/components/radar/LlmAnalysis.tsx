import {
  Title,
  Group,
  Tooltip,
  CopyButton,
  ActionIcon,
  Paper,
  Flex,
  ThemeIcon,
  Text,
  Stack,
} from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

import Markdown from '@/components/content/Markdown';

type LlmAnalysisProps = { analysis: string };

export default function LlmAnalysis({ analysis }: Readonly<LlmAnalysisProps>) {
  return (
    <Stack spacing='lg'>
      <Title order={2} fw='bolder'>
        Research Report
      </Title>

      <Paper
        withBorder={true}
        variant='prompt_form_submission_response'
        data-testid='prompt_response'
      >
        <Flex direction='row' align='flex-start' justify='space-between' p='sm'>
          <Text c='gray.0' size='md'>
            <Markdown value={analysis} />
          </Text>

          <Group>
            <CopyButton value={`${analysis}`} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip
                  label={copied ? 'Copied' : 'Copy'}
                  withArrow
                  position='right'
                >
                  <ActionIcon
                    color={copied ? 'teal' : 'gray'}
                    onClick={copy}
                    mr='md'
                  >
                    <ThemeIcon size={'sm'}>
                      {copied ? <IconCheck /> : <IconCopy aria-label='Copy' />}
                    </ThemeIcon>
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        </Flex>
      </Paper>
    </Stack>
  );
}
