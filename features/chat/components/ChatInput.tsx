import ChatForm from '@/features/chat/components/forms/ChatForm';

export default function ChatInput({
  onStartHereExpandedChange,
}: {
  onStartHereExpandedChange?: (expanded: boolean) => void;
} = {}) {
  return (
    <ChatForm onStartHereExpandedChange={onStartHereExpandedChange} />
  );
}
