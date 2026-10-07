import { Box, Text, Group, Skeleton } from '@mantine/core';

export default function DeepResearchLoading() {
  return (
    <Box>
      <Group mb='sm' spacing='sm'>
        <Text size='lg' fw={600} c='blue.6' mb='xs'>
          Deep research in progress
        </Text>
      </Group>
      <Text size='sm' mb='md'>
        Searching the web, analyzing findings, and synthesizing results. This typically takes 2-10 minutes depending on the complexity of your question.
      </Text>

      <Skeleton height={8} radius='xl'/>
      <Skeleton height={8} mt={6} radius='xl'/>
      <Skeleton height={8} mt={6} width='70%' radius='xl'/>
    </Box>
  );
}
