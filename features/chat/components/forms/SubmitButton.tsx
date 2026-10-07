import React, { useState } from 'react';
import { ActionIcon, Loader } from '@mantine/core';
import { IconArrowNarrowUp } from '@tabler/icons-react';

import { InputTooltip } from '@/features/shared/components/forms/InputTooltip';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { trpc } from '@/libs';
import { AsyncChatStatus, DeepResearchStatus } from '@/features/chat/types/message';
import useCancelDeepResearch from '@/features/chat/api/cancel-deep-research';
import useCancelAgenticChat from '@/features/chat/api/cancel-agentic-chat';
import CancelDeepResearchModal from '@/features/chat/components/modals/CancelDeepResearchModal';

type SubmitButtonProps = Readonly<{
  isSubmitDisabled: boolean;
  isPending: boolean;
  handleSubmit: () => void;
  tooltipMessage: string;
  isTooltipDisabled: boolean;
}>;

export default function SubmitButton({
  isSubmitDisabled,
  isPending,
  handleSubmit,
  tooltipMessage,
  isTooltipDisabled,
}: SubmitButtonProps) {
  const { chatId, deepResearchEnabled } = useChat();
  const [showCancelModal, setShowCancelModal] = useState(false);

  const cancelDeepResearch = useCancelDeepResearch(chatId || undefined);
  const cancelAgenticChat = useCancelAgenticChat(chatId || undefined);

  // Get latest messages to check for running deep research or agentic chat
  const { data: messagesData } = trpc.chat.getMessages.useQuery(
    { chatId: chatId || '' },
    { enabled: !!chatId }
  );

  // Find the latest deep research message that's still processing
  const runningDeepResearchMessage = messagesData?.messages?.find(
    msg => {
      if (!msg.deepResearch) {
        return false;
      }
      const status = msg.deepResearchStatus;
      return status === DeepResearchStatus.PENDING ||
             status === null ||
             status === undefined;
    }
  );

  // Find the latest agentic chat message that's still processing
  const runningAgenticChatMessage = messagesData?.messages?.find(
    msg => msg.asyncChatJobId && msg.asyncChatStatus === AsyncChatStatus.PROCESSING,
  );

  const handleCancelResearch = () => {
    setShowCancelModal(true);
  };

  const confirmCancelResearch = async () => {
    if (runningDeepResearchMessage?.deepResearchJobId) {
      try {
        await cancelDeepResearch.mutateAsync({ jobId: runningDeepResearchMessage.deepResearchJobId });
        setShowCancelModal(false);
      } catch {
        setShowCancelModal(false);
      }
    } else {
      setShowCancelModal(false);
    }
  };

  const handleCancelAgenticChat = async () => {
    if (runningAgenticChatMessage?.asyncChatJobId) {
      try {
        await cancelAgenticChat.mutateAsync({ jobId: runningAgenticChatMessage.asyncChatJobId });
      } catch {
        // error is surfaced via the mutation's onError handler
      }
    }
  };

  const isStopMode = !!runningDeepResearchMessage || !!runningAgenticChatMessage;

  return (
    <>
      <InputTooltip
        message={runningDeepResearchMessage ? 'Cancel deep research' : runningAgenticChatMessage ? 'Stop' : tooltipMessage}
        disabled={isStopMode ? false : isTooltipDisabled}
      >
        <ActionIcon
          aria-label={runningDeepResearchMessage ? 'Cancel research' : runningAgenticChatMessage ? 'Stop' : 'Send message'}
          variant='filled'
          radius='md'
          size='lg'
          color={isStopMode ? 'gray.9' : 'blue.6'}
          disabled={isStopMode ? false : isSubmitDisabled}
          onClick={runningDeepResearchMessage ? handleCancelResearch : runningAgenticChatMessage ? handleCancelAgenticChat : handleSubmit}
          style={{
            transition: 'all 0.2s ease-in-out',
          }}
        >
          {isStopMode ? (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader size='sm' color='#C6CAD2' />
              <div
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  backgroundColor: '#C6CAD2',
                  borderRadius: 1,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
          ) : (
            isPending && !deepResearchEnabled ? (
              <Loader size='sm' color='#C6CAD2' />
            ) : (
              <IconArrowNarrowUp color='#C6CAD2' size={26} stroke={2} />
            )
          )}
        </ActionIcon>
      </InputTooltip>

      <CancelDeepResearchModal
        opened={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={confirmCancelResearch}
      />
    </>
  );
}
