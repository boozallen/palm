import { Button, Group, Modal, Stack, Text, Badge, MultiSelect } from '@mantine/core';
import { useState, useEffect } from 'react';
import { trpc } from '@/libs/trpc';

type ShareAssetModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  assetName: string;
  assetType: 'workflow' | 'document';
  onConfirm: (selectedGroupIds: string[]) => void;
  isReshare?: boolean;
  currentSharedGroupIds?: string[];
}>;

export default function ShareAssetModal({
  modalOpened,
  closeModalHandler,
  assetName,
  assetType,
  onConfirm,
  isReshare = false,
  currentSharedGroupIds = [],
}: ShareAssetModalProps) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [userGroups, setUserGroups] = useState<{ value: string; label: string }[]>([]);

  const { data: userGroupsData } = trpc.profile.getUserGroups.useQuery();

  useEffect(() => {
    if (userGroupsData?.userGroups) {
      const groups = userGroupsData.userGroups.map((group) => ({
        value: group.id,
        label: group.label,
      }));
      setUserGroups(groups);
    }
  }, [userGroupsData]);

  // Pre-populate with current shared groups when resharing or reset when not
  useEffect(() => {
    if (modalOpened) {
      if (isReshare) {
        setSelectedGroupIds(currentSharedGroupIds);
      } else {
        setSelectedGroupIds([]);
      }
    }
  }, [modalOpened, isReshare, currentSharedGroupIds]);

  const handleShare = () => {
    onConfirm(selectedGroupIds);
    closeModalHandler();
    // Reset state after closing
    setSelectedGroupIds([]);
  };

  const handleClose = () => {
    closeModalHandler();
    // Reset state
    setSelectedGroupIds([]);
  };

  const groupsToAdd = selectedGroupIds.filter((id) => !currentSharedGroupIds.includes(id));
  const groupsToRemove = currentSharedGroupIds.filter((id) => !selectedGroupIds.includes(id));

  const hasChanges = isReshare
    ? groupsToAdd.length > 0 || groupsToRemove.length > 0
    : selectedGroupIds.length > 0;

  const getGroupLabel = (groupId: string) => {
    return userGroupsData?.userGroups.find((g) => g.id === groupId)?.label || groupId;
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={handleClose}
      withCloseButton={false}
      title={`Manage ${assetType} sharing`}
      data-testid='share-asset-modal'
      centered
    >
      <Stack spacing='md'>
        <Text color='gray.7' fz='sm' data-testid='body-text'>
          {isReshare && selectedGroupIds.length === 0
            ? `You are about to stop sharing the "${assetName}" ${assetType}. This will remove access for all user groups.`
            : isReshare && !hasChanges
            ? `Refresh the sharing invitation for the "${assetName}" ${assetType}. This will resend the invitation to users who may have previously rejected it.`
            : isReshare
            ? `Update which user groups have access to the "${assetName}" ${assetType}. This will refresh the sharing invitation for users who may have previously rejected it.`
            : `Share the "${assetName}" ${assetType} with user groups.`
          }
        </Text>

        {isReshare && currentSharedGroupIds.length > 0 && (
          <Stack spacing='xs'>
            <Text size='xs' weight={500} color='gray.7'>
              Currently shared with:
            </Text>
            <Group spacing='xs'>
              {currentSharedGroupIds.map((groupId) => (
                <Badge key={groupId} size='sm' variant='light' color='blue'>
                  {getGroupLabel(groupId)}
                </Badge>
              ))}
            </Group>
          </Stack>
        )}

        <MultiSelect
          label='User groups'
          placeholder='Select user groups to share with'
          data={userGroups}
          value={selectedGroupIds}
          onChange={setSelectedGroupIds}
          clearable
          data-testid='user-group-multiselect'
          description={`Select which user groups should receive this ${assetType}`}
          w='100%'
          dropdownPosition='bottom'
          withinPortal={true}
          data-autofocus={false}
        />

        {isReshare && (groupsToAdd.length > 0 || groupsToRemove.length > 0) && (
          <Stack spacing='xs'>
            {groupsToAdd.length > 0 && (
              <div>
                <Text size='xs' weight={500} color='green.7'>
                  Adding access:
                </Text>
                <Group spacing='xs' mt={4}>
                  {groupsToAdd.map((groupId) => (
                    <Badge key={groupId} size='sm' variant='light' color='green'>
                      {getGroupLabel(groupId)}
                    </Badge>
                  ))}
                </Group>
              </div>
            )}
            {groupsToRemove.length > 0 && (
              <div>
                <Text size='xs' weight={500} color='red.7'>
                  Removing access:
                </Text>
                <Group spacing='xs' mt={4}>
                  {groupsToRemove.map((groupId) => (
                    <Badge key={groupId} size='sm' variant='light' color='red'>
                      {getGroupLabel(groupId)}
                    </Badge>
                  ))}
                </Group>
              </div>
            )}
          </Stack>
        )}

        <Group spacing='lg' grow>
          <Button variant='outline' onClick={handleClose}>Cancel</Button>
          <Button onClick={handleShare} disabled={!hasChanges && !isReshare}>
            {isReshare && !hasChanges ? 'Refresh Share' : isReshare ? 'Update' : 'Share'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
