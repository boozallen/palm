import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';
import { Text } from '@mantine/core';

type ProviderUsageRowProps = Readonly<{
  label: string;
  cost: number;
}>

export default function ProviderUsageRow({ label, cost }: ProviderUsageRowProps) {
  return (
    <tr>
      <td>
        <Text fw='bolder'>{label}</Text>
      </td>
      <td></td>
      <td>
        <Text fw='bolder' fz='lg'>{formatCurrencyNumberForAnalytics(cost)}</Text>
      </td>
    </tr>
  );
}
