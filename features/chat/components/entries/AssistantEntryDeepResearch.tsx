import { useEffect, useRef } from 'react';

import Entry from '@/features/chat/components/entries/Entry';
import { MessageEntry } from '@/features/chat/types/entry';
import { MessageRole } from '@/features/chat/types/message';
import AssistantEntryActions from '@/features/chat/components/entries/actions/AssistantEntryActions';
import { useChat } from '@/features/chat/providers/ChatProvider';
import SelectedTextPopup from '@/features/chat/components/entries/actions/SelectedTextPopup';
import FollowUpQuestions from '@/features/chat/components/entries/elements/FollowUpQuestions';
import UserChoices from '@/features/chat/components/entries/elements/UserChoices';
import { useGetDeepResearchStatus } from '@/features/chat/api/get-deep-research-status';
import { DeepResearchStatus } from '@/features/chat/types/message';
import { trpc } from '@/libs';
import DeepResearchLoading from '@/features/chat/components/DeepResearchLoading';
import Markdown from '@/components/content/Markdown';

type AssistantEntryDeepResearchProps = Readonly<{
  entry: MessageEntry;
  isLatestResponse: boolean;
  followUpReferencedInNextUserEntry?: boolean;
}>;

export default function AssistantEntryDeepResearch({
  entry,
  isLatestResponse,
  followUpReferencedInNextUserEntry,
}: AssistantEntryDeepResearchProps) {
  const { chatId, useGraph } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  
  // Check if we should poll for status updates
  const shouldPoll = entry.deepResearchStatus === DeepResearchStatus.PENDING || !entry.deepResearchStatus;
  
  const { data: deepResearchStatus } = useGetDeepResearchStatus(
    shouldPoll ? (entry.deepResearchJobId ?? undefined) : undefined,
    chatId || '',
    entry.id 
  );
  
  // Determine current research status from either live status or entry status
  const currentStatus = deepResearchStatus?.status || entry.deepResearchStatus;
  const isProcessing = currentStatus === DeepResearchStatus.PENDING || !currentStatus;
  
  // Refresh messages when deep research completes or is cancelled
  useEffect(() => {
    if ((deepResearchStatus?.status === DeepResearchStatus.COMPLETED ||
         deepResearchStatus?.status === DeepResearchStatus.CANCELLED) && chatId) {
      utils.chat.getMessages.invalidate({ chatId });
    }
  }, [deepResearchStatus?.status, chatId, utils.chat.getMessages]);

  const renderContent = () => {
    if (isProcessing) {
      return <DeepResearchLoading />;
    }

    if (currentStatus === DeepResearchStatus.CANCELLED) {
      return <Markdown value='Research cancelled' />;
    }
    
    // Deep research has completed - show the actual content
    return <Markdown value={entry.content} />;
  };

  return (
    <div style={{ position: 'relative' }}>
      <Entry
        id={entry.id}
        avatar={null}
        role={MessageRole.Assistant}
        deepResearch={true}
        useGraph={useGraph}
        citations={entry.citations}
        artifacts={entry.artifacts}
        actions={
          !isProcessing ? (
            <AssistantEntryActions
              messageId={entry.id}
              messageContent={entry.content}
              feedback={entry.feedback}
            />
          ) : null
        }
      >
        <div ref={containerRef}>
          {renderContent()}
        </div>
      </Entry>

      <UserChoices userChoices={entry.userChoices} />

      <FollowUpQuestions
        followUpQuestions={followUpReferencedInNextUserEntry || isLatestResponse ? entry.followUps : []}
      />

      <SelectedTextPopup containerRef={containerRef} messageId={entry.id} />
    </div>
  );
}
