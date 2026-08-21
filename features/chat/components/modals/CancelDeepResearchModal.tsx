import { Modal, Text, Button, Group } from '@mantine/core';

type CancelDeepResearchModalProps = Readonly<{
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
}>;

export default function CancelDeepResearchModal({
  opened,
  onClose,
  onConfirm,
}: CancelDeepResearchModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      title='Cancel Deep Research'
      data-test-id='cancel-deep-research-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to cancel the current action?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm}>Cancel Research</Button>
      </Group>
    </Modal>
  );
}
