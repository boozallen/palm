import { Table } from '@mantine/core';
import Loading from '@/features/shared/components/Loading';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import AzureAdScopesConfigRow from './AzureAdScopesConfigRow';

export default function AzureAdScopesTable() {
  const { data: systemConfig, isPending: systemConfigPending } = useGetSystemConfig();

  if (systemConfigPending) {
    return <Loading />;
  }

  if (!systemConfig?.azureAdEnabled) {
    return null;
  }

  const currentScopes = systemConfig?.azureAdScopes ?? ['openid', 'profile', 'email'];

  return (
    <Table data-testid='azure-ad-scopes-table'>
      <thead>
        <tr>
          <th>Authentication - Azure AD</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <AzureAdScopesConfigRow currentScopes={currentScopes} />
      </tbody>
    </Table>
  );
}
