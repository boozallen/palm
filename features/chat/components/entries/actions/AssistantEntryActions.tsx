import { Group } from '@mantine/core';

import CopyEntryContent from './action-item/CopyEntryContent';
import RateChatMessage from './action-item/RateChatMessage';
import RegenerateChatResponse from './action-item/RegenerateChatResponse';
import { MessageFeedback } from '@/features/chat/types/message';

type AssistantEntryProps = Readonly<{
  messageContent: string;
  messageId: string;
  feedback?: MessageFeedback | null;
}>;

export default function AssistantEntryActions({
  messageContent,
  messageId,
  feedback,
}: AssistantEntryProps) {

  return (
    <Group spacing='xs'>
      <CopyEntryContent messageContent={messageContent} messageId={messageId} />
      <RateChatMessage messageId={messageId} feedback={feedback} />
      <RegenerateChatResponse messageId={messageId} />
    </Group>
  );
}
