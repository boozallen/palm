import { SimpleGrid, Title, Text, Stack } from '@mantine/core';
import Analytics from '@/features/settings/components/analytics/Analytics';

export default function AnalyticsPage() {
  return (
    <>
      <SimpleGrid cols={2} p='xl' bg='dark.6'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            Analytics
          </Title>
          <Text fz='md' c='gray.6'>
            Gain insights into application usage with advanced filtering options.
          </Text>
        </Stack>
      </SimpleGrid>
      <Analytics />
    </>
  );
}
