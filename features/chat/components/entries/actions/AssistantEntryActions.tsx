import { Group } from '@mantine/core';

import CopyEntryContent from './action-item/CopyEntryContent';
import RegenerateChatResponse from './action-item/RegenerateChatResponse';

type AssistantEntryProps = Readonly<{
  messageContent: string;
  messageId: string;
}>;

export default function AssistantEntryActions({
  messageContent,
  messageId,
}: AssistantEntryProps) {

  return (
    <Group spacing='xs'>
      <CopyEntryContent messageContent={messageContent} />
      <RegenerateChatResponse messageId={messageId} />
    </Group>
  );
}
