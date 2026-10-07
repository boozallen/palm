import { Button, Group, Modal, Text } from '@mantine/core';

type RoleDemotionConfirmationModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  onConfirm: () => void;
}>;

export default function RoleDemotionConfirmationModal({
  modalOpened,
  closeModalHandler,
  onConfirm,
}: RoleDemotionConfirmationModalProps) {

  const handleConfirm = () => {
    onConfirm();
    closeModalHandler();
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Confirm Role Change'
      data-testid='role-demotion-confirmation-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to change your user group role from <strong>Lead</strong> to <strong>User</strong>?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>
          Cancel
        </Button>
        <Button onClick={handleConfirm}>Confirm Change </Button>
      </Group>
    </Modal>
  );
}
