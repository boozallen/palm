import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useDeleteCertaPolicy from '@/features/settings/api/ai-agents/certa/delete-certa-policy';

type DeletePolicyModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  policyId: string;
}>;

export default function DeletePolicyModal({
  modalOpened,
  closeModalHandler,
  policyId,
}: DeletePolicyModalProps) {
  const {
    mutateAsync: deleteCertaPolicy,
    isPending: deleteCertaPolicyIsPending,
    error: deleteCertaPolicyError,
  } = useDeleteCertaPolicy();
  const handleDeletePolicy = async () => {
    try {
      await deleteCertaPolicy({ policyId: policyId });
      closeModalHandler();
    } catch (error) {
      notifications.show({
        title: 'Remove policy failed',
        message: deleteCertaPolicyError?.message ?? 'There was an error deleting the policy',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={closeModalHandler}
      withCloseButton={false}
      title='Delete CERTA Policy'
      data-test-id='delete-policy-modal'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        Are you sure you want to delete this policy?
      </Text>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={closeModalHandler}>
          Cancel
        </Button>
        <Button
          onClick={handleDeletePolicy}
          loading={deleteCertaPolicyIsPending}
        >
          {!deleteCertaPolicyIsPending ? 'Delete Policy' : 'Deleting Policy'}
        </Button>
      </Group>
    </Modal>
  );
}
