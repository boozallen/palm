import { Group, Stack, Title } from '@mantine/core';
import SystemPersonaTable from './tables/SystemPersonaTable';
import TermsOfUseTable from './tables/TermsOfUseTable';
import LegalPolicyTable from './tables/LegalPolicyTable';
import JoinUserGroupDialogTable from './tables/JoinUserGroupDialogTable';
import DefaultUserGroupSelectionTable from './tables/DefaultUserGroupSelectionTable';
import DocumentLibraryDocumentUploadProviderSelectionTable from './tables/DocumentLibraryDocumentUploadProviderSelectionTable';
import SystemAiProviderModelSelectionTable from './tables/SystemAiProviderModelSelectionTable';
import FastAiProviderModelSelectionTable from './tables/FastAiProviderModelSelectionTable';
import KnowledgeGraphAiProviderModelSelectionTable from './tables/KnowledgeGraphAiProviderModelSelectionTable';
import FeatureManagementTable from './tables/FeatureManagementTable';
import AzureAdScopesTable from './tables/AzureAdScopesTable';

export default function SystemConfigurations() {

  return (
    <Stack spacing='md'>
      <Group>
        <Title weight='bold' color='gray.6' order={2} data-testid='system-configurations-title'>
          System Configurations
        </Title>
      </Group>
      <Stack spacing='md' p='md' bg='dark.6'>
        <SystemPersonaTable />
        <TermsOfUseTable />
        <LegalPolicyTable />
        <JoinUserGroupDialogTable />
        <DefaultUserGroupSelectionTable />
        <SystemAiProviderModelSelectionTable />
        <FastAiProviderModelSelectionTable />
        <KnowledgeGraphAiProviderModelSelectionTable />
        <DocumentLibraryDocumentUploadProviderSelectionTable />
        <AzureAdScopesTable />
        <FeatureManagementTable />
      </Stack>
    </Stack>
  );
}
