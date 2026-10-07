import { useState } from 'react';
import { Button, Modal, Select, Text } from '@mantine/core';

import { PinWorkflowGroupOption } from '@/features/workflows/hooks/usePinWorkflowGroup';

type PinWorkflowGroupModalProps = Readonly<{
  opened: boolean;
  groups: PinWorkflowGroupOption[];
  onSelect: (userGroupId: string) => void;
}>;

export default function PinWorkflowGroupModal({
  opened,
  groups,
  onSelect,
}: PinWorkflowGroupModalProps) {
  const [userGroupId, setUserGroupId] = useState<string | null>(null);

  const handleContinue = () => {
    if (!userGroupId) {
      return;
    }
    onSelect(userGroupId);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title='Choose a user group for this workflow'
      centered
    >
      <Text color='gray.7' fz='sm' mb='md'>
        This workflow will be permanently tied to one user group. The group you choose determines which AI providers and models are available in every node, and what this workflow&apos;s usage is tracked under for cost tracking purposes. This can&apos;t be changed later.
      </Text>

      <Select
        data-testid='pin-workflow-group-select'
        data={groups.map((group) => ({ value: group.id, label: group.label }))}
        value={userGroupId}
        onChange={setUserGroupId}
        placeholder='Select a user group'
      />

      <Button
        data-testid='pin-workflow-group-continue-button'
        onClick={handleContinue}
        disabled={!userGroupId}
        fullWidth
        mt='md'
      >
        Continue
      </Button>
    </Modal>
  );
}
