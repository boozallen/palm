import { useEffect, useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconThumbDown, IconThumbUp, IconX } from '@tabler/icons-react';

import MessageFeedbackModal from '@/features/chat/components/modals/MessageFeedbackModal';
import useRateMessage from '@/features/chat/api/rate-message';
import useDeleteMessageFeedback from '@/features/chat/api/delete-message-feedback';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import { MessageFeedback, MessageFeedbackIssueType, MessageFeedbackRating } from '@/features/chat/types/message';

type RateChatMessageProps = Readonly<{
  messageId: string;
  feedback?: MessageFeedback | null;
}>;

function showFeedbackErrorNotification(title: string) {
  notifications.show({
    title,
    message: 'An unexpected error occurred. Please try again later.',
    icon: <IconX />,
    autoClose: false,
    withCloseButton: true,
    variant: 'failed_operation',
  });
}

export default function RateChatMessage({ messageId, feedback }: RateChatMessageProps) {
  const { chatId } = useChat();
  const track = useTrackClientEvent();
  const [activeRating, setActiveRating] = useState<MessageFeedbackRating | null>(feedback?.rating ?? null);
  const [pendingRating, setPendingRating] = useState<MessageFeedbackRating | null>(null);
  const [opened, { open, close }] = useDisclosure();
  const { mutate: rateMessage, isPending: isRatingPending } = useRateMessage();
  const { mutate: deleteMessageFeedback, isPending: isClearingPending } = useDeleteMessageFeedback();

  useEffect(() => {
    setActiveRating(feedback?.rating ?? null);
  }, [feedback?.rating]);

  const handleOpen = (rating: MessageFeedbackRating) => {
    setPendingRating(rating);
    track.messageFeedback.open(rating, messageId, chatId);
    open();
  };

  const handleClick = (rating: MessageFeedbackRating) => {
    if (!chatId || isRatingPending || isClearingPending) {
      return;
    }

    if (activeRating === rating) {
      deleteMessageFeedback(
        { chatId, messageId },
        {
          onSuccess: () => setActiveRating(null),
          onError: () => showFeedbackErrorNotification('Clear Message Feedback Failed'),
        }
      );
      return;
    }

    handleOpen(rating);
  };

  const handleClose = () => {
    if (pendingRating) {
      track.messageFeedback.cancel(pendingRating, messageId, chatId);
    }
    close();
  };

  const handleSubmit = (comment: string, issueType?: MessageFeedbackIssueType) => {
    if (!pendingRating || !chatId) {
      return;
    }

    rateMessage(
      { chatId, messageId, rating: pendingRating, comment: comment || undefined, issueType },
      {
        onSuccess: () => setActiveRating(pendingRating),
        onError: () => showFeedbackErrorNotification('Rate Message Failed'),
      }
    );
    close();
  };

  const isThumbsUpLoading =
    (isRatingPending && pendingRating === MessageFeedbackRating.Positive) ||
    (isClearingPending && activeRating === MessageFeedbackRating.Positive);
  const isThumbsDownLoading =
    (isRatingPending && pendingRating === MessageFeedbackRating.Negative) ||
    (isClearingPending && activeRating === MessageFeedbackRating.Negative);

  return (
    <>
      <MessageFeedbackModal
        opened={opened}
        rating={pendingRating}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
      <Tooltip label='Good response' position='right'>
        <ActionIcon
          data-testid='thumbs-up-button'
          className='entry-hover-visible'
          color={activeRating === MessageFeedbackRating.Positive ? 'blue' : 'gray'}
          aria-pressed={activeRating === MessageFeedbackRating.Positive}
          loading={isThumbsUpLoading}
          disabled={isRatingPending || isClearingPending}
          onClick={() => handleClick(MessageFeedbackRating.Positive)}
        >
          <IconThumbUp
            aria-label='Good response'
            stroke={activeRating === MessageFeedbackRating.Positive ? 1.5 : 1}
            data-testid='thumbs-up-icon'
          />
        </ActionIcon>
      </Tooltip>
      <Tooltip label='Bad response' position='right'>
        <ActionIcon
          data-testid='thumbs-down-button'
          className='entry-hover-visible'
          color={activeRating === MessageFeedbackRating.Negative ? 'blue' : 'gray'}
          aria-pressed={activeRating === MessageFeedbackRating.Negative}
          loading={isThumbsDownLoading}
          disabled={isRatingPending || isClearingPending}
          onClick={() => handleClick(MessageFeedbackRating.Negative)}
        >
          <IconThumbDown
            aria-label='Bad response'
            stroke={activeRating === MessageFeedbackRating.Negative ? 1.5 : 1}
            data-testid='thumbs-down-icon'
          />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
