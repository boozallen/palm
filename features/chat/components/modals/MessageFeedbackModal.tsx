import { forwardRef, LegacyRef, useState } from 'react';
import { Button, Group, Modal, Select, Text, Textarea } from '@mantine/core';

import { MessageFeedbackIssueType, MessageFeedbackRating } from '@/features/chat/types/message';

interface IssueTypeItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: MessageFeedbackIssueType;
  label: string;
}

const IssueTypeItem = forwardRef<HTMLDivElement, IssueTypeItemProps>(
  ({ value, label, ...others }: IssueTypeItemProps, ref: LegacyRef<HTMLDivElement> | undefined) => (
    <div ref={ref} data-testid={`message-feedback-issue-option-${value}`} {...others}>
      {label}
    </div>
  )
);
IssueTypeItem.displayName = 'IssueTypeItem';

type MessageFeedbackModalProps = Readonly<{
  opened: boolean;
  rating: MessageFeedbackRating | null;
  onClose: () => void;
  onSubmit: (comment: string, issueType?: MessageFeedbackIssueType) => void;
}>;

const MODAL_COPY: Record<MessageFeedbackRating, { title: string; placeholder: string }> = {
  [MessageFeedbackRating.Positive]: {
    title: 'Give positive feedback',
    placeholder: 'What was helpful about this response?',
  },
  [MessageFeedbackRating.Negative]: {
    title: 'Give negative feedback',
    placeholder: 'What could be improved about this response?',
  },
};

const ISSUE_TYPE_LABELS: Record<MessageFeedbackIssueType, string> = {
  [MessageFeedbackIssueType.UiBug]: 'UI bug',
  [MessageFeedbackIssueType.OveractiveRefusal]: 'Overactive refusal',
  [MessageFeedbackIssueType.PoorImageUnderstanding]: 'Poor image understanding',
  [MessageFeedbackIssueType.DidNotFollowRequest]: 'Did not fully follow my request',
  [MessageFeedbackIssueType.NotFactuallyCorrect]: 'Not factually correct',
  [MessageFeedbackIssueType.IncompleteResponse]: 'Incomplete response',
  [MessageFeedbackIssueType.IssueWithThoughtProcess]: 'Issue with thought process',
  [MessageFeedbackIssueType.ShouldNotHaveSearchedWeb]: 'Shouldn\'t have searched the web',
  [MessageFeedbackIssueType.DontLikeCitedSources]: 'Don\'t like the cited sources',
  [MessageFeedbackIssueType.IssueWithMemory]: 'Issue with memory',
  [MessageFeedbackIssueType.Other]: 'Other',
};

const ISSUE_TYPE_OPTIONS = Object.values(MessageFeedbackIssueType).map((value) => ({
  value,
  label: ISSUE_TYPE_LABELS[value],
}));

export default function MessageFeedbackModal({
  opened,
  rating,
  onClose,
  onSubmit,
}: MessageFeedbackModalProps) {
  const [comment, setComment] = useState('');
  const [issueType, setIssueType] = useState<MessageFeedbackIssueType | null>(null);

  const handleClose = () => {
    setComment('');
    setIssueType(null);
    onClose();
  };

  const handleSubmit = () => {
    onSubmit(comment, issueType ?? undefined);
    setComment('');
    setIssueType(null);
  };

  if (!rating) {
    return null;
  }

  const { title, placeholder } = MODAL_COPY[rating];

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      withCloseButton={false}
      title={<span data-testid='message-feedback-title'>{title}</span>}
      centered
    >
      {rating === MessageFeedbackRating.Negative && (
        <Select
          data-testid='message-feedback-issue-type'
          itemComponent={IssueTypeItem}
          label='What type of issue do you wish to report?'
          description='(optional)'
          placeholder='Select...'
          data={ISSUE_TYPE_OPTIONS}
          value={issueType}
          onChange={(value) => setIssueType(value as MessageFeedbackIssueType | null)}
          clearable
          mb='md'
        />
      )}
      <Text color='gray.7' fz='sm' mb='md'>
        Please provide details (optional).
      </Text>
      <Textarea
        data-testid='message-feedback-comment'
        placeholder={placeholder}
        value={comment}
        onChange={(e) => setComment(e.currentTarget.value)}
        minRows={3}
        maxLength={2000}
      />
      <Group spacing='lg' grow>
        <Button data-testid='message-feedback-cancel-button' variant='outline' onClick={handleClose}>Cancel</Button>
        <Button data-testid='message-feedback-submit-button' onClick={handleSubmit}>Submit</Button>
      </Group>
    </Modal>
  );
}
