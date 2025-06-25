import { Table, Text } from '@mantine/core';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import DocumentLibraryKbProviderConfigRow from './DocumentLibraryKbProviderConfigRow';
import Loading from '@/features/shared/components/Loading';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { features } from '@/libs/featureFlags';

export default function DocumentLibraryKbProviderSelectionTable() {

  const { data: systemConfig, isPending: systemConfigIsPending, error: systemConfigError } = useGetSystemConfig();

  const { data: featureDocumentLibrary } = useGetFeatureFlag({
    feature: features.DOCUMENT_LIBRARY,
  });

  if (!featureDocumentLibrary?.isFeatureOn) {
    return <></>;
  }

  if (systemConfigIsPending) {
    return <Loading />;
  }

  if (systemConfigError) {
    return <Text>{systemConfigError.message}</Text>;
  }

  return (
    <Table data-testid='document-library-kb-provider-selection-table'>
      <thead>
        <tr>
          <th>Personal Document Library</th>
        </tr>
      </thead>
      <tbody>
        <DocumentLibraryKbProviderConfigRow
          documentLibraryKbProviderId={systemConfig.documentLibraryKbProviderId}
        />
      </tbody>
    </Table>
  );
}
