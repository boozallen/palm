import { Badge, Text, Spoiler } from '@mantine/core';

import { AnalysisStatus, AnalysisConfidence } from '@/features/ai-agents/types/swear/analysisItem';
import type { AnalysisItem } from '@/features/ai-agents/types/swear/analysisItem';

function getStatusColor(status: AnalysisStatus): string {
  switch (status) {
    case AnalysisStatus.PASS:
      return 'green';
    case AnalysisStatus.FAIL:
      return 'red';
    case AnalysisStatus.PARTIAL:
      return 'orange';
    case AnalysisStatus.NA:
      return 'gray';
  }
}

function getConfidenceColor(confidence: AnalysisConfidence): string {
  switch (confidence) {
    case AnalysisConfidence.HIGH:
      return 'green';
    case AnalysisConfidence.MEDIUM:
      return 'yellow';
    case AnalysisConfidence.LOW:
      return 'red';
  }
}

type ChecklistItemRowProps = Readonly<{
  item: AnalysisItem;
}>;

export default function ChecklistItemRow({ item }: ChecklistItemRowProps) {
  return (
    <tr>
      <td>
        <Text size='sm'>{item.requirement}</Text>
      </td>
      <td>
        <Badge
          color={`${getStatusColor(item.status)}.6`}
          variant='filled'
          c='black'
        >
          {item.status}
        </Badge>
      </td>
      <td>
        <Badge
          color={`${getConfidenceColor(item.confidence)}.6`}
          variant='filled'
          c='black'
        >
          {item.confidence}
        </Badge>
      </td>
      <td>
        <Spoiler maxHeight={60} showLabel='Show more' hideLabel='Show less'>
          <Text size='sm'>{item.evidence}</Text>
        </Spoiler>
      </td>
    </tr>
  );
}
