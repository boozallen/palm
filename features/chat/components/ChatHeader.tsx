import { Group, SimpleGrid } from '@mantine/core';

import ChatModelSelect from './ChatModelSelect';
import ChatDocumentLibraryInput from './ChatDocumentLibraryInput';
import ChatKnowledgeBasesSelect from './ChatKnowledgeBasesSelect';
export default function ChatHeader() {

  return (
    <SimpleGrid cols={3}>
      <div>
        {/* empty */}
      </div>
      <Group position='center'>
        <ChatModelSelect />
      </Group>
      <Group position='right'>
        <ChatDocumentLibraryInput />
        <ChatKnowledgeBasesSelect />
      </Group>
    </SimpleGrid>
  );
}
