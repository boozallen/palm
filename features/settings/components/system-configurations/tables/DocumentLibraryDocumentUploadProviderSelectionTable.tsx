import { Table, Text } from '@mantine/core';

import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import DocumentLibraryDocumentUploadProviderConfigRow from './DocumentLibraryDocumentUploadProviderConfigRow';
import Loading from '@/features/shared/components/Loading';

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
        </tr>
      </thead>
      <tbody>
        <DocumentLibraryDocumentUploadProviderConfigRow
          documentUploadProviderId={systemConfig.documentLibraryDocumentUploadProviderId}
        />
      </tbody>
    </Table>
  );
}
