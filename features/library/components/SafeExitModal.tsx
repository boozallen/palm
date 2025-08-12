import { Button, Group, Modal, Text, Title, useMantineTheme } from '@mantine/core';

type Props = {
  isOpen: boolean;
  onLeave: () => void;
  onCancel: () => void;
};

export default function SafeExitModal({ isOpen, onLeave, onCancel }: Props) {

  const theme = useMantineTheme();

  return (
    <>
      <Modal
        centered={true}
        opened={isOpen}
        onClose={() => onCancel()}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        size='xs'
        padding='lg'
      >
        <div style={{ paddingBottom: `${theme.spacing.lg}` }}>
          <Title order={3} color='gray' mb='xs'>
            Are you sure you want to leave?
          </Title>
          <Text color='gray.7' fz='sm'>
            If you leave now, all input will not be saved.
          </Text>
        </div>
        <Group spacing='lg' grow>
          <Button
            variant='filled'
            onClick={onLeave}
          >
            Yes, Leave
          </Button>
          <Button variant='outline' color='gray'
            onClick={onCancel}
          >
            Cancel
          </Button>
        </Group>
      </Modal>
    </>
  );
}
