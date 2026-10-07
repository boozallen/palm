import { Group, Stack, Text, Title } from '@mantine/core';

import AiProvidersUsageTable from './tables/AiProvidersUsageTable';
import { formatCurrencyNumberForAnalytics, formatTokenCount } from '@/features/shared/utils';
import { UsageRecords } from '@/features/context-studio/types/cost';

type AiProviderUsageResultsProps = Readonly<{
  results: UsageRecords | undefined;
}>;

export default function AiProviderUsageResults({ results }: AiProviderUsageResultsProps) {

  if (!results) {
    return <></>;
  }

  const initiatedByLabel = `Initiated By: ${results.initiatedBy}`;
  const userGroupLabel = `User Group: ${results.userGroupLabel ?? 'All groups'}`;
  const userLabel = `User: ${results.userName ?? 'All users'}`;
  const aiProviderLabel = `Provider: ${results.aiProvider ?? 'All providers'}`;
  const modelLabel = `Model: ${results.model ?? 'All models'}`;
  const timeRangeLabel = `Time Range: ${results.timeRange}`;

  const filters = `${userGroupLabel}, ${userLabel}, ${initiatedByLabel}, ${aiProviderLabel}, ${modelLabel}, ${timeRangeLabel}`;

  const hasUserData = results.users && results.users.length > 0;
  const hasNoResults = !hasUserData && results.providers.length === 0;

  if (hasNoResults) {
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

      <Stack bg='dark.6' p='md' spacing='md'>
        <Group align='center' position='apart'>
          <Title weight='bold' color='gray.6' order={2} fz='xl' data-testid='ai-providers-title'>AI Providers</Title>
          <Group spacing='md'>
            <Stack spacing='xs'>
              <Text size='sm' color='dark.0' data-testid='total-input-label'>Input Tokens</Text>
              <Text size='lg' c='cyan.5' weight='bold' data-testid='total-input-value'>{formatTokenCount(results.totalInputTokens)}</Text>
            </Stack>
            <Stack spacing='xs'>
              <Text size='sm' color='dark.0' data-testid='total-output-label'>Output Tokens</Text>
              <Text size='lg' c='cyan.5' weight='bold' data-testid='total-output-value'>{formatTokenCount(results.totalOutputTokens)}</Text>
            </Stack>
            <Stack spacing='xs'>
              <Text size='sm' color='dark.0' data-testid='total-cost-label'>Total Cost</Text>
              <Text size='lg' color='gray.6' weight='bold' data-testid='total-cost-value'>{formatCurrencyNumberForAnalytics(results.totalCost)}</Text>
            </Stack>
          </Group>
        </Group>
        <AiProvidersUsageTable providerCosts={results.providers} users={results.users} />
      </Stack>
    </>
  );
}
