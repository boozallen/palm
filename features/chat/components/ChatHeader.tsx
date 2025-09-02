import { Group } from '@mantine/core';

import ChatModelSelect from './ChatModelSelect';
import ChatDocumentLibraryInput from './ChatDocumentLibraryInput';
import ChatKnowledgeBasesSelect from './ChatKnowledgeBasesSelect';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import Loading from '@/features/shared/components/Loading';

export default function ChatHeader() {
  const {
    data: systemConfig,
    isPending: systemConfigIsLoading,
  } = useGetSystemConfig();

  if (systemConfigIsLoading) {
    return <Loading />;
  }

  return (
    <Group position='left' p='lg' spacing='lg'>
      <ChatModelSelect />
      <ChatKnowledgeBasesSelect />
      {systemConfig?.documentLibraryDocumentUploadProviderId && (
        <ChatDocumentLibraryInput />
      )}
    </Group>
  );
}
