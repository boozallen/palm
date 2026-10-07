import { Button, Group, Modal, Text } from '@mantine/core';

type Props = {
  isOpen: boolean;
  onExtendSession: () => void;
  timeRemainingMS: number;
};

export default function IdleLogoutWarningModal({ isOpen, onExtendSession, timeRemainingMS }: Props) {

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds} seconds`;
  };

  return (
    <Modal
      centered={true}
      opened={isOpen}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      size='xs'
      padding='lg'
      title='Are you still there?'
    >
      <Text color='gray.7' fz='sm' mb='sm'>
        You have been inactive and your session will expire in {formatTime(timeRemainingMS)}.
      </Text>
      <Text color='gray.7' fz='sm' mb='md'>
        Click the button below to continue your session.
      </Text>
      <Group spacing='lg' grow>
        <Button
          variant='filled'
          onClick={onExtendSession}
        >
          Continue session
        </Button>
      </Group>
    </Modal>
  );
}
