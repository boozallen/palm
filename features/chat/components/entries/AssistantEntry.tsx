import { useEffect, useRef } from 'react';

import Entry from '@/features/chat/components/entries/Entry';
import Markdown from '@/components/content/Markdown';
import { MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import AssistantEntryActions from '@/features/chat/components/entries/actions/AssistantEntryActions';
import { useChat } from '@/features/chat/providers/ChatProvider';
import SelectedTextPopup from '@/features/chat/components/entries/actions/SelectedTextPopup';
import FollowUpQuestions from '@/features/chat/components/entries/elements/FollowUpQuestions';

type AssistantEntryProps = Readonly<{
  entry: MessageEntry;
  isLatestResponse: boolean;
  followUpReferencedInNextUserEntry?: boolean;
}>;

export default function AssistantEntry({
  entry,
  isLatestResponse,
  followUpReferencedInNextUserEntry,
}: AssistantEntryProps) {
  const { setSelectedArtifact } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLatestResponse && entry.artifacts?.length) {
      setSelectedArtifact(entry.artifacts[0]);
    }
  }, [isLatestResponse, entry.artifacts, setSelectedArtifact]);

  return (
    <div style={{ position: 'relative' }}>
      <Entry
        id={entry.id}
        avatar={null}
        role={MessageRole.Assistant}
        citations={entry.citations}
        artifacts={entry.artifacts}
        actions={
          <AssistantEntryActions
            messageId={entry.id}
            messageContent={entry.content}
          />
        }
      >
        <div ref={containerRef}>
          <Markdown value={entry.content} />
        </div>
      </Entry>

      <FollowUpQuestions
        followUpQuestions={followUpReferencedInNextUserEntry || isLatestResponse ? entry.followUps : []}
      />

      <SelectedTextPopup
        containerRef={containerRef}
      />
    </div>
  );
}
