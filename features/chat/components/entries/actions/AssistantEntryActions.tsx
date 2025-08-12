import { Group } from '@mantine/core';

import CopyEntryContent from './action-item/CopyEntryContent';
import RegenerateChatResponse from './action-item/RegenerateChatResponse';

type AssistantEntryProps = Readonly<{
  messageContent: string;
  isLastEntry: boolean;
}>;

export default function AssistantEntryActions({
  messageContent,
  isLastEntry,
}: AssistantEntryProps) {

  return (
    <Group spacing='xs'>
      <CopyEntryContent messageContent={messageContent} />
      {isLastEntry && <RegenerateChatResponse />}
    </Group>
  );
}
