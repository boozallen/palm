import { Group, Stack, Title } from '@mantine/core';
import SystemPersonaTable from './tables/SystemPersonaTable';
import TermsOfUseTable from './tables/TermsOfUseTable';
import LegalPolicyTable from './tables/LegalPolicyTable';
import DefaultUserGroupSelectionTable from './tables/DefaultUserGroupSelectionTable';
import DocumentLibraryDocumentUploadProviderSelectionTable from './tables/DocumentLibraryDocumentUploadProviderSelectionTable';
import SystemAiProviderModelSelectionTable from './tables/SystemAiProviderModelSelectionTable';
import FeatureManagementTable from './tables/FeatureManagementTable';

export default function SystemConfigurations() {

  return (
    <Stack spacing='md'>
      <Group>
        <Title weight='bold' color='gray.6' order={2}>
          System Configurations
        </Title>
      </Group>
      <Stack spacing='md' p='xl' bg='dark.6'>
        <SystemPersonaTable />
        <TermsOfUseTable />
        <LegalPolicyTable />
        <DefaultUserGroupSelectionTable />
        <SystemAiProviderModelSelectionTable />
        <DocumentLibraryDocumentUploadProviderSelectionTable />
        <FeatureManagementTable />
      </Stack>
    </Stack>
  );
}
