import { Button, Group, Modal, Text } from '@mantine/core';

type CopyWorkflowModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  workflowName: string;
  onConfirm: () => void;
}>;

export default function CopyWorkflowModal({
  modalOpened,
  closeModalHandler,
  workflowName,
  onConfirm,
}: CopyWorkflowModalProps) {

  const handleCopy = () => {
    onConfirm();
    closeModalHandler();
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Confirm workflow copy'
      data-testid='copy-workflow-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md' data-testid='body-text'>
        {`Are you sure you want to copy the "${workflowName}" workflow? A duplicate will be added to your workflows.`}
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>Cancel</Button>
        <Button onClick={handleCopy}>Copy</Button>
      </Group>
    </Modal>
  );
}
