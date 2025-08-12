import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { Box, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import CreatePromptForm from '@/features/shared/components/forms/CreatePromptForm';
import { PromptFormValues } from '@/features/shared/types';

export default function CreatePrompt() {
  const router = useRouter();
  const { promptData } = router.query;

  const parsedPromptData: Partial<PromptFormValues> = useMemo(() => {
    if (typeof promptData === 'string') {
      return JSON.parse(decodeURIComponent(promptData));
    }
    return {};
  }, [promptData]);
  
  return (
    <>
      <SimpleGrid cols={2} p='xl'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.0'>
            Add a Prompt
          </Title>
          <Text fz='md' c='gray.6'>
            Fill out the form below to add a new prompt to the library.
          </Text>
        </Stack>
      </SimpleGrid>

      <Box bg='dark.6' p='xl'>
        <CreatePromptForm prompt={parsedPromptData} />
      </Box>
    </>
  );
}
