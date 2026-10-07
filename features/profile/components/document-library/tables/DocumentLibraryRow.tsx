import { ActionIcon, Group, Indicator, Loader, Text, Tooltip } from '@mantine/core';
import { IconTrash, IconNetwork, IconFolders } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useSession } from 'next-auth/react';

import { Document, DocumentUploadStatus, uploadStatusColorCode } from '@/features/shared/types/document';
import DeletePersonalDocumentModal from '@/features/profile/components/document-library/modals/DeletePersonalDocumentModal';
import ManageDocumentCollectionsModal from '@/features/shared/components/document-library/modals/ManageDocumentCollectionsModal';
import CollectionBadges from '@/features/shared/components/document-library/components/CollectionBadges';
import useBuildGraph from '@/features/graph-database/api/build-graph';
import { trpc } from '@/libs';

type DocumentLibraryRowProps = Readonly<{
  document: Document;
  hasGraphAccess: boolean;
  isGraphed: boolean;
  isGraphing: boolean;
  isUngraphable?: boolean;
}>;

export default function DocumentLibraryRow({ document, hasGraphAccess, isGraphed, isGraphing, isUngraphable = false }: DocumentLibraryRowProps) {
  const { data: session } = useSession();

  const [
    deletePersonalDocumentModalOpened,
    { open: openDeletePersonalDocumentModal, close: closeDeletePersonalDocumentModal },
  ] = useDisclosure(false);

  const [
    manageCollectionsModalOpened,
    { open: openManageCollectionsModal, close: closeManageCollectionsModal },
  ] = useDisclosure(false);

  const utils = trpc.useUtils();
  const { mutateAsync: buildGraph, isPending: isBuildingGraph } = useBuildGraph();

  const handleBuildGraph = async () => {
    await buildGraph({ documentIds: [document.id] });
    // Kick off the active-builds polling so the spinner appears immediately
    utils.graph.getActiveGraphBuilds.invalidate();
  };

  // Admin documents can only be deleted by their creator (the lead/admin who uploaded them)
  const isAdminDocOwnedByOther = document.adminCreated && document.userId !== session?.user?.id;

  const isDocumentReady = document.uploadStatus === DocumentUploadStatus.Completed;
  const isCurrentlyGraphing = isGraphing || isBuildingGraph;

  const formattedDate = new Date(document.createdAt).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });

  return (
    <>
      <DeletePersonalDocumentModal
        modalOpened={deletePersonalDocumentModalOpened}
        closeModalHandler={closeDeletePersonalDocumentModal}
        documentId={document.id}
      />

      <ManageDocumentCollectionsModal
        modalOpened={manageCollectionsModalOpened}
        closeModalHandler={closeManageCollectionsModal}
        documentId={document.id}
        documentFilename={document.filename}
        currentCollectionIds={document.collections?.map((c) => c.id) || []}
      />

      <tr>
        <td>
          <div>
            <Text>{document.filename}</Text>
            {document.collections && document.collections.length > 0 && (
              <CollectionBadges collections={document.collections} />
            )}
          </div>
        </td>
        <td>{formattedDate}</td>
        <td>
          <Indicator
            ml='sm'
            inline
            position='middle-start'
            color={uploadStatusColorCode[document.uploadStatus]}
          >
            <Text ml='md'>
              {document.uploadStatus}
            </Text>
          </Indicator>
        </td>
        <td>
          <Group spacing='xs'>
            <Tooltip label='Manage collections' position='left' withinPortal>
              <ActionIcon
                aria-label='Manage document collections'
                onClick={openManageCollectionsModal}
                variant='transparent'
              >
                <IconFolders />
              </ActionIcon>
            </Tooltip>

            {hasGraphAccess && isDocumentReady && (!isAdminDocOwnedByOther || isGraphed || isUngraphable) && (
              <Tooltip
                label={
                  isUngraphable
                    ? 'No graph entities found in this document'
                    : isGraphed
                    ? 'Document is graphed'
                    : isCurrentlyGraphing
                    ? 'Graphing in progress...'
                    : 'Graph this document'
                }
                position='left'
                withinPortal
              >
                <div>
                  <ActionIcon
                    aria-label={isGraphed ? 'Document is graphed' : 'Graph this document'}
                    onClick={isGraphed || isCurrentlyGraphing || isAdminDocOwnedByOther || isUngraphable ? undefined : handleBuildGraph}
                    variant='transparent'
                    sx={(theme) => ({
                      color: isGraphed
                        ? theme.fn.variant({ variant: 'filled', color: 'green' }).background
                        : isUngraphable
                        ? theme.colors.gray[6]
                        : undefined,
                      opacity: isCurrentlyGraphing || isUngraphable ? 0.5 : 1,
                      cursor: isGraphed || isCurrentlyGraphing || isAdminDocOwnedByOther || isUngraphable ? 'default' : 'pointer',
                      '&:hover': { backgroundColor: 'transparent' },
                    })}
                  >
                    {isCurrentlyGraphing ? <Loader size={16} color='yellow' /> : <IconNetwork />}
                  </ActionIcon>
                </div>
              </Tooltip>
            )}

            <Tooltip
              label='Unable to modify user group-wide resources'
              disabled={!isAdminDocOwnedByOther}
              position='left'
              withinPortal
            >
              <div>
                <ActionIcon
                  aria-label={`Delete document ${document.id}`}
                  onClick={isAdminDocOwnedByOther ? undefined : openDeletePersonalDocumentModal}
                  sx={isAdminDocOwnedByOther ? (theme) => ({
                    color: theme.colors.gray[6],
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    '&:hover': { backgroundColor: 'transparent' },
                  }) : undefined}
                >
                  <IconTrash />
                </ActionIcon>
              </div>
            </Tooltip>
          </Group>
        </td>
      </tr>
    </>
  );
}
