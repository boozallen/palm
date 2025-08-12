import { Group } from '@mantine/core';

import ChatModelSelect from './ChatModelSelect';
import ChatDocumentLibraryInput from './ChatDocumentLibraryInput';
import ChatKnowledgeBasesSelect from './ChatKnowledgeBasesSelect';
export default function ChatHeader() {

  return (
    <Group position='left' p='lg' spacing='lg'>
      <ChatModelSelect />
      <ChatKnowledgeBasesSelect />
      <ChatDocumentLibraryInput />
    </Group>
  );
}
