import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { IconChevronDown, IconChevronRight, IconCheck, IconX } from '@tabler/icons-react';

import { trpc } from '@/libs';
import { UserRole } from '@/features/shared/types/user';
import CenteredLoader from '@/features/shared/components/CenteredLoader';
import useGetAdminDocuments from '@/features/settings/api/data-sources/get-admin-documents';
import useDemoteCollection from '@/features/settings/api/data-sources/demote-admin-document-collection';
import useGetUserGroupsAsLead from '@/features/settings/api/user-groups/get-user-groups-as-lead';
import useGetUserGroups from '@/features/settings/api/user-groups/get-user-groups';
import AddAdminDataSourceModal from './modals/AddAdminDataSourceModal';
import ShareFolderModal from './modals/ShareFolderModal';
import AdminDataSourcesTable, { GroupOption } from './tables/AdminDataSourcesTable';
import CollectionsTable, { CollectionRow } from './tables/CollectionsTable';

export default function AdminDataSources() {
  const { data: sessionData } = useSession();
  const userIsAdmin = sessionData?.user.role === UserRole.Admin;
  const currentUserId = sessionData?.user?.id ?? '';

  const [addModalOpened, { open: openAddModal, close: closeAddModal }] = useDisclosure(false);
  const [preselectedDocumentId, setPreselectedDocumentId] = useState<string | undefined>(undefined);
  const [shareModalOpened, { open: openShareModal, close: closeShareModal }] = useDisclosure(false);
  const [shareCollection, setShareCollection] = useState<{ id: string; name: string; groupIds: string[]; mixed: boolean } | null>(null);

  const [removeShareModalOpened, { open: openRemoveShareModal, close: closeRemoveShareModal }] = useDisclosure(false);
  const [removeShareCollection, setRemoveShareCollection] = useState<{ id: string; name: string; count: number } | null>(null);

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collectionsCollapsed, { toggle: toggleCollections }] = useDisclosure(false);

  const utils = trpc.useUtils();
  const { mutateAsync: demoteCollection, isPending: isRemovingShare } = useDemoteCollection();

  const { data: adminDocsData, isPending, error } = useGetAdminDocuments();

  // System admins see all groups; group leads see only their groups
  const { data: allGroupsData } = useGetUserGroups();
  const { data: leadGroupsData } = useGetUserGroupsAsLead();

  const availableGroups = useMemo((): GroupOption[] => {
    const groups = userIsAdmin
      ? (allGroupsData?.userGroups ?? [])
      : (leadGroupsData?.userGroupsAsLead ?? []);
    return groups.map(g => ({ id: g.id, label: g.label }));
  }, [userIsAdmin, allGroupsData?.userGroups, leadGroupsData?.userGroupsAsLead]);

  const documents = useMemo(() => adminDocsData?.documents ?? [], [adminDocsData?.documents]);

  // Collections are derived from the visible documents, so their scope always
  // matches the table (admin -> all docs, lead -> own docs) and the per-folder
  // counts reflect exactly what is visible here.
  const collections = useMemo((): CollectionRow[] => {
    const map = new Map<string, { row: CollectionRow; groupIds: Set<string>; signatures: Set<string> }>();
    for (const doc of documents) {
      for (const c of doc.collections ?? []) {
        let entry = map.get(c.id);
        if (!entry) {
          entry = {
            row: {
              id: c.id,
              name: c.name,
              color: c.color,
              sharedCount: 0,
              mixedGroups: false,
              sharedGroupIds: [],
              sharedGroupLabels: [],
              ownerId: c.ownerId,
              ownerName: c.ownerName,
              count: 0,
            },
            groupIds: new Set<string>(),
            signatures: new Set<string>(),
          };
          map.set(c.id, entry);
        }
        entry.row.count += 1;
        if (doc.adminCreated) {
          entry.row.sharedCount += 1;
          // Signature of this shared doc's group set; if shared docs have
          // differing signatures the folder is heterogeneous ("mixed").
          entry.signatures.add([...(doc.assignedGroupIds ?? [])].sort().join('|'));
        }
        for (const groupId of doc.assignedGroupIds ?? []) {
          entry.groupIds.add(groupId);
        }
      }
    }
    return Array.from(map.values())
      .map(({ row, groupIds, signatures }) => ({
        ...row,
        mixedGroups: signatures.size > 1,
        sharedGroupIds: Array.from(groupIds),
        sharedGroupLabels: Array.from(groupIds)
          .map(id => availableGroups.find(g => g.id === id)?.label)
          .filter((label): label is string => label !== undefined)
          .sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [documents, availableGroups]);

  // If the selected collection disappears (its last visible doc was removed),
  // fall back to "all documents".
  useEffect(() => {
    if (selectedCollectionId && !collections.some(c => c.id === selectedCollectionId)) {
      setSelectedCollectionId(null);
    }
  }, [collections, selectedCollectionId]);

  const visibleDocuments = useMemo(() => {
    if (!selectedCollectionId) {
      return documents;
    }
    return documents.filter(doc => (doc.collections ?? []).some(c => c.id === selectedCollectionId));
  }, [documents, selectedCollectionId]);

  const selectedCollection = selectedCollectionId
    ? collections.find(c => c.id === selectedCollectionId) ?? null
    : null;

  if (isPending) {
    return <CenteredLoader />;
  }

  if (error) {
    return <Text c='red'>{error.message}</Text>;
  }

  const handleOpenPromoteModal = (documentId: string) => {
    setPreselectedDocumentId(documentId);
    openAddModal();
  };

  const handleCloseModal = () => {
    setPreselectedDocumentId(undefined);
    closeAddModal();
  };

  const handleShareCollection = (collectionId: string, collectionName: string) => {
    const row = collections.find(c => c.id === collectionId);
    setShareCollection({
      id: collectionId,
      name: collectionName,
      groupIds: row?.sharedGroupIds ?? [],
      mixed: row?.mixedGroups ?? false,
    });
    openShareModal();
  };

  const handleCloseShareModal = () => {
    setShareCollection(null);
    closeShareModal();
  };

  const handleRemoveShareCollection = (collectionId: string, collectionName: string) => {
    const row = collections.find(c => c.id === collectionId);
    setRemoveShareCollection({ id: collectionId, name: collectionName, count: row?.count ?? 0 });
    openRemoveShareModal();
  };

  const handleCloseRemoveShareModal = () => {
    setRemoveShareCollection(null);
    closeRemoveShareModal();
  };

  const handleConfirmRemoveShare = async () => {
    if (!removeShareCollection) {
      return;
    }
    try {
      await demoteCollection({ collectionId: removeShareCollection.id });
      utils.settings.dataSources.getAdminDocuments.invalidate();
      utils.shared.getDocuments.invalidate();
      notifications.show({
        title: 'Share Status Removed',
        message: `"${removeShareCollection.name}" is no longer shared as an admin data source`,
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: 3000,
      });
      handleCloseRemoveShareModal();
    } catch (error) {
      notifications.show({
        title: 'Failed',
        message: error instanceof Error ? error.message : 'Failed to remove share status',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
        withCloseButton: true,
      });
    }
  };

  return (
    <Stack spacing='md'>
      <AddAdminDataSourceModal
        modalOpen={addModalOpened}
        closeModalHandler={handleCloseModal}
        availableGroups={availableGroups}
        preselectedDocumentId={preselectedDocumentId}
      />

      <ShareFolderModal
        opened={shareModalOpened}
        onClose={handleCloseShareModal}
        collectionId={shareCollection?.id ?? null}
        collectionName={shareCollection?.name ?? ''}
        initialGroupIds={shareCollection?.groupIds ?? []}
        mixedWarning={shareCollection?.mixed ?? false}
        availableGroups={availableGroups}
      />

      <Modal
        opened={removeShareModalOpened}
        onClose={handleCloseRemoveShareModal}
        withCloseButton={false}
        title='Remove Share Status'
        data-testid='remove-collection-share-modal'
        centered
      >
        <Text color='gray.7' fz='sm' mb='md'>
          Remove admin data source status from all {removeShareCollection?.count ?? 0} document
          {(removeShareCollection?.count ?? 0) === 1 ? '' : 's'} in
          {' '}&quot;{removeShareCollection?.name}&quot;? The documents stay in their owners&apos; libraries,
          but group members will lose access and the folder will no longer be shared.
        </Text>
        <Group spacing='lg' grow>
          <Button variant='outline' onClick={handleCloseRemoveShareModal} disabled={isRemovingShare}>
            Cancel
          </Button>
          <Button onClick={handleConfirmRemoveShare} loading={isRemovingShare} data-testid='confirm-remove-collection-share'>
            Remove Share Status
          </Button>
        </Group>
      </Modal>

      <Title weight='bold' color='gray.6' order={2}>
        Document Library
      </Title>

      {documents.length === 0 ? (
        <Box bg='dark.8' p='md'>
          <Text c='gray.4'>No documents have been uploaded yet.</Text>
        </Box>
      ) : (
        <Stack spacing='md'>
          {collections.length > 0 && (
            <Stack spacing='xs'>
              <Group spacing='xs'>
                <Tooltip label={collectionsCollapsed ? 'Show collections' : 'Hide collections'}>
                  <ActionIcon
                    size='sm'
                    variant='subtle'
                    onClick={toggleCollections}
                    data-testid='collections-collapse-toggle'
                    aria-label={collectionsCollapsed ? 'Show collections' : 'Hide collections'}
                  >
                    {collectionsCollapsed ? <IconChevronRight size={16} /> : <IconChevronDown size={16} />}
                  </ActionIcon>
                </Tooltip>
                <Text fz='sm' fw={600} c='gray.5'>
                  Collections
                </Text>
              </Group>

              {!collectionsCollapsed && (
                <CollectionsTable
                  collections={collections}
                  selectedCollectionId={selectedCollectionId}
                  currentUserId={currentUserId}
                  isAdmin={userIsAdmin}
                  onSelect={setSelectedCollectionId}
                  onShare={handleShareCollection}
                  onRemoveShare={handleRemoveShareCollection}
                />
              )}
            </Stack>
          )}

          {selectedCollection && (
            <Group spacing='xs'>
              <Text fz='sm' c='dimmed'>
                Showing folder:
              </Text>
              <Text fz='sm' fw={600}>
                {selectedCollection.name}
              </Text>
              {selectedCollection.sharedCount > 0 && (
                <Badge size='sm' color='teal' variant='light'>
                  {selectedCollection.sharedCount >= selectedCollection.count
                    ? 'Shared'
                    : `${selectedCollection.sharedCount} of ${selectedCollection.count} shared`}
                </Badge>
              )}
              <Button
                size='xs'
                variant='subtle'
                leftIcon={<IconX size={14} />}
                onClick={() => setSelectedCollectionId(null)}
                data-testid='clear-collection-filter'
              >
                Clear
              </Button>
            </Group>
          )}

          <AdminDataSourcesTable
            documents={visibleDocuments}
            availableGroups={availableGroups}
            currentUserId={currentUserId}
            onPromoteDocument={handleOpenPromoteModal}
          />
        </Stack>
      )}
    </Stack>
  );
}
