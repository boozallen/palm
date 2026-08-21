import { Table, Text } from '@mantine/core';

import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import DocumentLibraryDocumentUploadProviderConfigRow from './DocumentLibraryDocumentUploadProviderConfigRow';
import FeatureManagementConfigRow from './FeatureManagementConfigRow';
import Loading from '@/features/shared/components/Loading';
import { SystemConfigFields } from '@/features/shared/types';

export default function DocumentLibraryDocumentUploadProviderSelectionTable() {

  const { data: systemConfig, isPending: systemConfigIsPending, error: systemConfigError } = useGetSystemConfig();

  if (systemConfigIsPending) {
    return <Loading />;
  }

  if (systemConfigError) {
    return <Text>{systemConfigError.message}</Text>;
  }

  return (
    <Table data-testid='document-library-document-upload-provider-selection-table'>
      <thead>
        <tr>
          <th>Document Library</th>
          <th>Enabled</th>
        </tr>
      </thead>
      <tbody>
        <DocumentLibraryDocumentUploadProviderConfigRow
          documentUploadProviderId={systemConfig.documentLibraryDocumentUploadProviderId}
        />
        <FeatureManagementConfigRow
          field={SystemConfigFields.DocumentLibraryDataSharingEnabled}
          label='Data Sharing'
          checked={!!(systemConfig?.documentLibraryDataSharingEnabled ?? false)}
        />
      </tbody>
    </Table>
  );
}
