import Entry from '@/features/chat/components/entries/Entry';
import Markdown from '@/components/content/Markdown';
import { MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import AssistantEntryActions from '@/features/chat/components/entries/actions/AssistantEntryActions';

type AssistantEntryProps = Readonly<{
  entry: MessageEntry;
  isLastEntry: boolean;
}>;

export default function AssistantEntry({
  entry,
  isLastEntry,
}: AssistantEntryProps) {

  return (
    <Entry
      id={entry.id}
      avatar={null}
      role={MessageRole.Assistant}
      citations={entry.citations}
      artifacts={entry.artifacts}
      actions={
        <AssistantEntryActions
          messageContent={entry.content}
          isLastEntry={isLastEntry}
        />
      }
    >
      <Markdown value={entry.content} />
    </Entry>
  );
}
