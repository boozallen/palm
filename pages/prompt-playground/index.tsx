import PromptPlaygroundForm from '@/features/playground/components/PromptPlaygroundForm';
import { SimpleGrid, Stack, Text, Title } from '@mantine/core';

export default function PromptPlayground() {

  return (
    <>
      <SimpleGrid cols={2} p='md'>
        <Stack spacing='xxs'>
          <Title
            order={1}
            fz='xxl'
            c='gray.1'
          >
            Prompt Playground
          </Title>
          <Text c='gray.6' fz='md'>
            Compare large language model outputs side-by-side
          </Text>
        </Stack>
      </SimpleGrid>
      <PromptPlaygroundForm />
    </>
  );
}
