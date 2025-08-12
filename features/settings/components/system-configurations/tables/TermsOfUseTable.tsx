import { Table, Text } from '@mantine/core';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import TermsOfUseConfigRow from '@/features/settings/components/system-configurations/tables/TermsOfUseConfigRow';
import Loading from '@/features/shared/components/Loading';

export default function TermsOfUseTable() {
  const { data: systemConfig, isPending: systemConfigIsPending, error: systemConfigError } = useGetSystemConfig();

  if (systemConfigIsPending) {
    return <Loading />;
  }

  if (systemConfigError) {
    return <Text>{systemConfigError.message}</Text>;
  }

  return (
    <Table data-testid='terms-of-use-table'>
      <thead >
        <tr>
          <th colSpan={2}>Terms of Use Acknowledgement</th>
        </tr>
      </thead>
      <tbody>
        <TermsOfUseConfigRow termsOfUseHeader={systemConfig.termsOfUseHeader} termsOfUseBody={systemConfig.termsOfUseBody} termsOfUseCheckboxLabel={systemConfig.termsOfUseCheckboxLabel} />
      </tbody>
    </Table>
  );
}
