import { Table } from '@mantine/core';
import SystemMessageConfigRow from './SystemMessageConfigRow';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

export default function SystemPersonaTable() {
  const systemConfig = useGetSystemConfig();

  return (
    <Table data-testid='system-persona-table'>
      <thead >
        <tr>
          <th colSpan={2}>System Persona</th>
        </tr>
      </thead>
      <tbody>
        <SystemMessageConfigRow systemMessage={systemConfig.data?.systemMessage || ''}/>
      </tbody>
    </Table>
  );
}
