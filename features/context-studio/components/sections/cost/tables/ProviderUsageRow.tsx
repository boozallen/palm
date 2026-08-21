import { calculateTokenCost, formatCurrencyNumberForAnalytics, formatTokenCount } from '@/features/shared/utils';
import { Stack, Text } from '@mantine/core';

type ProviderUsageRowProps = Readonly<{
  label: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}>

export default function ProviderUsageRow({ label, cost, inputTokens, outputTokens, costPerInputToken, costPerOutputToken }: ProviderUsageRowProps) {
  const inputCost = calculateTokenCost(inputTokens, costPerInputToken);
  const outputCost = calculateTokenCost(outputTokens, costPerOutputToken);

  return (
    <tr data-testid='provider-usage-row'>
      <td data-testid='provider-label'>
        <Text fw='bolder'>{label}</Text>
      </td>
      <td></td>
      <td data-testid='provider-input-tokens' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <Stack spacing={0} align='flex-end'>
          <Text fw='bolder' color='gray.6'>{formatTokenCount(inputTokens)}</Text>
          {costPerInputToken !== undefined && inputTokens > 0 && (
            <Text size='xs' color='dimmed'>{formatCurrencyNumberForAnalytics(inputCost)}</Text>
          )}
        </Stack>
      </td>
      <td data-testid='provider-output-tokens' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <Stack spacing={0} align='flex-end'>
          <Text fw='bolder' color='gray.6'>{formatTokenCount(outputTokens)}</Text>
          {costPerOutputToken !== undefined && outputTokens > 0 && (
            <Text size='xs' color='dimmed'>{formatCurrencyNumberForAnalytics(outputCost)}</Text>
          )}
        </Stack>
      </td>
      <td data-testid='provider-cost' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <Text fw='bolder' fz='lg'>{formatCurrencyNumberForAnalytics(cost)}</Text>
      </td>
    </tr>
  );
}
