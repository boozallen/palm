import { calculateTokenCost, formatCurrencyNumberForAnalytics, formatTokenCount } from '@/features/shared/utils';
import { Stack, Text } from '@mantine/core';

type ModelUsageRowProps = Readonly<{
  label: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}>

export default function ModelUsageRow({ label, cost, inputTokens, outputTokens, costPerInputToken, costPerOutputToken }: ModelUsageRowProps) {
  const inputCost = calculateTokenCost(inputTokens, costPerInputToken);
  const outputCost = calculateTokenCost(outputTokens, costPerOutputToken);

  return (
    <tr className='provider-model-row' data-testid='model-usage-row'>
      <td></td>
      <td data-testid='model-label'>{label}</td>
      <td data-testid='model-input-tokens' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <Stack spacing={0} align='flex-end'>
          <Text color='gray.7'>{formatTokenCount(inputTokens)}</Text>
          {costPerInputToken !== undefined && inputTokens > 0 && (
            <Text size='xs' color='dimmed'>{formatCurrencyNumberForAnalytics(inputCost)}</Text>
          )}
        </Stack>
      </td>
      <td data-testid='model-output-tokens' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <Stack spacing={0} align='flex-end'>
          <Text color='gray.7'>{formatTokenCount(outputTokens)}</Text>
          {costPerOutputToken !== undefined && outputTokens > 0 && (
            <Text size='xs' color='dimmed'>{formatCurrencyNumberForAnalytics(outputCost)}</Text>
          )}
        </Stack>
      </td>
      <td data-testid='model-cost' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyNumberForAnalytics(cost)}</td>
    </tr>
  );
}
