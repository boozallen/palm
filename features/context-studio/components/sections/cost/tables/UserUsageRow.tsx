import { Text } from '@mantine/core';

import { formatCurrencyNumberForAnalytics, formatTokenCount } from '@/features/shared/utils';

type UserUsageRowProps = Readonly<{
  name: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
}>;

export default function UserUsageRow({ name, cost, inputTokens, outputTokens }: UserUsageRowProps) {
  return (
    <tr data-testid='user-usage-row'>
      <td data-testid='user-name'>
        <Text fw='bolder'>{name}</Text>
      </td>
      <td></td>
      <td></td>
      <td data-testid='user-input-tokens' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <Text fw='bolder' color='gray.6'>{formatTokenCount(inputTokens)}</Text>
      </td>
      <td data-testid='user-output-tokens' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <Text fw='bolder' color='gray.6'>{formatTokenCount(outputTokens)}</Text>
      </td>
      <td data-testid='user-cost' style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <Text fw='bolder' fz='lg'>{formatCurrencyNumberForAnalytics(cost)}</Text>
      </td>
    </tr>
  );
}
