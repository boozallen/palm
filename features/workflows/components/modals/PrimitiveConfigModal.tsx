/**
 * Primitive Configuration Modal
 * Opens when user clicks the settings icon on a node
 */

import { Modal, Button, Group, Text, TextInput, Stack } from '@mantine/core';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import { PrimitiveType } from '@/features/workflows/types/primitive';
import { getNodeDef } from '@/features/workflows/utils/node-registry';

interface PrimitiveConfigModalProps {
  opened: boolean;
  onClose: () => void;
  nodeId: string;
  nodeType: PrimitiveType;
  nodeLabel: string;
  currentConfig: Record<string, unknown>;
  onSave: (nodeId: string, label: string, config: Record<string, unknown>) => void;
  workflowId?: string;
  onSaveToDatabase?: (nodeId: string, label: string, config: Record<string, unknown>) => Promise<void>;
}

export default function PrimitiveConfigModal({
  opened,
  onClose,
  nodeId,
  nodeType,
  nodeLabel: initialLabel,
  currentConfig,
  onSave,
  workflowId,
  onSaveToDatabase,
}: PrimitiveConfigModalProps) {
  const [label, setLabel] = useState(initialLabel);
  const [config, setConfig] = useState(currentConfig);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    if (isUploading || isSaving) {
      return;
    }
    onClose();
  };

  const handleSave = async () => {
    if (workflowId && onSaveToDatabase) {
      try {
        setIsSaving(true);
        await onSaveToDatabase(nodeId, label, config);
        onSave(nodeId, label, config);
      } catch (error) {
        notifications.show({
          title: 'Save Failed',
          message: error instanceof Error ? error.message : 'Failed to save configuration',
          color: 'red',
          icon: <IconX />,
        });
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    } else {
      onSave(nodeId, label, config);
    }

    onClose();
  };

  const isSaveDisabled = () => {
    if (isUploading || isSaving) {
      return true;
    }
    if (nodeType === PrimitiveType.DOCUMENT) {
      return !config.documentId;
    }
    return false;
  };

  const { ConfigComponent, label: typeLabel } = getNodeDef(nodeType);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={`Configure ${typeLabel}`}
      size={typeLabel === 'Prompt' ? 'xl' : 'lg'}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={!isUploading}
    >
      <Stack spacing='xs' data-testid='primitive-config-modal'>
        <Group spacing='sm' noWrap align='center'>
          <Text mb='md' size='sm' c='gray.0' fw={500} style={{ whiteSpace: 'nowrap' }}>
            Name
          </Text>
          <TextInput
            placeholder='Give this step a descriptive name'
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
            required
            style={{ flex: 1 }}
            data-testid='node-label-input'
          />
        </Group>

        <ConfigComponent
          config={config}
          onChange={setConfig}
          onUploadingChange={setIsUploading}
        />

        <Group spacing='lg' grow>
          <Button variant='outline' onClick={handleClose} disabled={isUploading || isSaving} data-testid='cancel-button'>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled()} loading={isUploading || isSaving} data-testid='save-button'>
            {isUploading ? 'Uploading document' : isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
