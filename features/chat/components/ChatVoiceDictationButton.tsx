import { Tooltip, ActionIcon } from '@mantine/core';
import { IconMicrophone } from '@tabler/icons-react';

import useVoiceDictation, { isVoiceDictationSupported } from '@/features/chat/hooks/useVoiceDictation';

type ChatVoiceDictationButtonProps = Readonly<{
  onTranscript: (text: string) => void;
}>;

export default function ChatVoiceDictationButton({
  onTranscript,
}: ChatVoiceDictationButtonProps) {
  const { isListening, toggle } = useVoiceDictation({ onTranscript });

  if (!isVoiceDictationSupported()) {
    return <></>;
  }

  return (
    <Tooltip
      label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
      events={{ 'hover': true, 'focus': true, 'touch': true }}
    >
      <ActionIcon
        mt='xs'
        data-testid='chat-voice-dictation-button'
        variant={isListening ? 'filled' : 'transparent'}
        color={isListening ? 'green.6' : 'gray'}
        size='lg'
        onClick={toggle}
      >
        <IconMicrophone size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
