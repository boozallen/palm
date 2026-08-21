import { Table } from '@mantine/core';

import ChecklistItemRow from './ChecklistItemRow';
import type { AnalysisItem } from '@/features/ai-agents/types/swear/analysisItem';

type ChecklistTableProps = Readonly<{
  items: AnalysisItem[];
}>;

export default function ChecklistTable({ items }: ChecklistTableProps) {
  return (
    <Table striped highlightOnHover>
      <thead>
        <tr>
          <th style={{ width: '30%' }}>Requirement</th>
          <th style={{ width: '10%' }}>Status</th>
          <th style={{ width: '10%' }}>Confidence</th>
          <th style={{ width: '50%' }}>Document Evidence & Reasoning</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <ChecklistItemRow key={index} item={item} />
        ))}
      </tbody>
    </Table>
  );
}
