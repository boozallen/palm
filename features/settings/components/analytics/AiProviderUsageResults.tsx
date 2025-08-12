import { Group, Stack, Text, Title } from '@mantine/core';

import AiProvidersUsageTable from './tables/AiProvidersUsageTable';
import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';
import { UsageRecords } from '@/features/settings/types/analytics';

type AiProviderUsageResultsProps = Readonly<{
  results: UsageRecords | undefined;
}>;

export default function AiProviderUsageResults({ results }: AiProviderUsageResultsProps) {

  if (!results) {
    return <></>;
  }
  const initiatedByLabel = `Initiated By: ${results.initiatedBy}`;
  const aiProviderLabel = `Provider: ${results.aiProvider ?? 'All providers'}`;
  const modelLabel = `Model: ${results.model ?? 'All models'}`;
  const timeRangeLabel = `Time Range: ${results.timeRange}`;

  const filters = `${initiatedByLabel}, ${aiProviderLabel}, ${modelLabel}, ${timeRangeLabel}`;

  // Shouldn't ever hit this case, but just in case...
  if (results.providers.length === 0) {
    return (
      <Text color='gray.6' fz='md'>
        No Results Found: {filters}
      </Text>
    );
  }

  return (
    <>
      <Text color='gray.6' fz='md'>
        {filters}
      </Text>

      <Stack bg='dark.6' p='xl' spacing='md'>
        <Group align='center' position='apart'>
          <Title weight='bold' color='gray.6' order={2} fz='xl'>AI Providers</Title>
          <Stack spacing='xs'>
            <Text size='sm' color='dark.0'>Total Cost</Text>
            <Text size='lg' color='gray.6' weight='bold'>{formatCurrencyNumberForAnalytics(results.totalCost)}</Text>
          </Stack>
        </Group>
        <AiProvidersUsageTable providerCosts={results.providers} />
      </Stack>
    </>
  );
}
