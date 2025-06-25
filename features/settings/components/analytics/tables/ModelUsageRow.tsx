import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';

type ModelUsageRowProps = Readonly<{
  label: string;
  cost: number;
}>

export default function ModelUsageRow({ label, cost }: ModelUsageRowProps) {

  return (
    <tr className='provider-model-row'>
      <td></td>
      <td>{label}</td>
      <td>{formatCurrencyNumberForAnalytics(cost)}</td>
    </tr>
  );
}
