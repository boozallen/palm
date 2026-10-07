import { Badge, Text, Spoiler } from '@mantine/core';

import { ComplianceStatus } from '@/features/ai-agents/types/prism/complianceResult';
import type { ComplianceResult } from '@/features/ai-agents/types/prism/complianceResult';

function getStatusColor(status: ComplianceStatus): string {
  switch (status) {
    case ComplianceStatus.YES:
      return 'green';
    case ComplianceStatus.NO:
      return 'red';
    case ComplianceStatus.NOT_APPLICABLE:
      return 'gray';
    case ComplianceStatus.NEEDS_REVIEW:
      return 'yellow';
  }
}

function getStatusLabel(status: ComplianceStatus): string {
  switch (status) {
    case ComplianceStatus.YES:
      return 'Yes';
    case ComplianceStatus.NO:
      return 'No';
    case ComplianceStatus.NOT_APPLICABLE:
      return 'N/A';
    case ComplianceStatus.NEEDS_REVIEW:
      return 'Needs Review';
  }
}

type ResultRowProps = Readonly<{
  item: ComplianceResult;
  showCitations: boolean;
}>;

export default function ResultRow({ item, showCitations }: ResultRowProps) {
  return (
    <tr>
      <td>
        <Text size='sm'>{item.requirement}</Text>
      </td>
      <td>
        <Badge
          color={`${getStatusColor(item.complianceStatus)}.6`}
          variant='filled'
          c='black'
        >
          {getStatusLabel(item.complianceStatus)}
        </Badge>
      </td>
      <td>
        <Spoiler maxHeight={60} showLabel='Show more' hideLabel='Show less'>
          <Text size='sm'>{item.reasoning}</Text>
        </Spoiler>
      </td>
      <td>
        {showCitations ? (
          <Spoiler maxHeight={60} showLabel='Show more' hideLabel='Show less'>
            <Text size='sm' fs={item.citations ? 'normal' : 'italic'} c={item.citations ? undefined : 'dimmed'}>
              {item.citations ?? 'No citation'}
            </Text>
          </Spoiler>
        ) : (
          <Text size='sm' c='dimmed' ta='center'>-</Text>
        )}
      </td>
    </tr>
  );
}
