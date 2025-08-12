import { ActionIcon, Box, CopyButton, Flex, Group, Paper, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { AiResponse } from '@/features/ai-provider/sources/types';
import Markdown from '@/components/content/Markdown';

type PromptResponseFormProps = Readonly<{
  data: AiResponse
}>;

export default function PromptFormSubmissionResponse({ data }: PromptResponseFormProps) {

  return (
    <Box px='xl' py='lg'>
      <Paper withBorder={true} variant='prompt_form_submission_response' data-testid='prompt_response'>
        <Flex direction='row' align='flex-start' justify='space-between' p='sm'>
          <Text c='gray.0' size='md'>
            <Markdown value={data.text} />
          </Text>
          <Group>
            <CopyButton value={`${data.text}`} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position='right'>
                  <ActionIcon color={copied ? 'teal' : 'gray'} onClick={copy} mr='md'>
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
    </Box>
  );
}
