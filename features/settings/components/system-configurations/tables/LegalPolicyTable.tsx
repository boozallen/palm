import { Table, Text } from '@mantine/core';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import LegalPolicyConfigRow from '@/features/settings/components/system-configurations/tables/LegalPolicyConfigRow';
import Loading from '@/features/shared/components/Loading';

export default function LegalPolicyTable() {
  const { data: systemConfig, isPending: systemConfigIsPending, error: systemConfigError } = useGetSystemConfig();

  if (systemConfigIsPending) {
    return <Loading />;
  }

  if (systemConfigError) {
    return <Text>{systemConfigError.message}</Text>;
  }

  return (
    <Table data-testid='legal-policy-table'>
      <thead>
        <tr>
          <th colSpan={2}>Legal Policy</th>
        </tr>
      </thead>
      <tbody>
        <LegalPolicyConfigRow legalPolicyHeader={systemConfig.legalPolicyHeader} legalPolicyBody={systemConfig.legalPolicyBody} />
      </tbody>
    </Table>
  );
}
