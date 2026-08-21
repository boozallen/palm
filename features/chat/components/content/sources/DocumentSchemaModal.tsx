import { Fragment, useMemo, useState } from 'react';
import { Modal, Table, Badge, Text, Group, TextInput, ScrollArea, Stack, Center, Tooltip, ActionIcon, ThemeIcon } from '@mantine/core';
import { IconSearch, IconFolder, IconChevronRight, IconFolderCog, IconFileImport } from '@tabler/icons-react';

import ManageDocumentCollectionsModal from '@/features/shared/components/document-library/modals/ManageDocumentCollectionsModal';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useGetGraphedDocuments } from '@/features/graph-database/api/get-graphed-documents';
import { useGetActiveGraphBuilds } from '@/features/graph-database/api/get-active-graph-builds';
import { useGetUserProvidedGraphDocuments } from '@/features/graph-database/api/get-user-provided-graph-documents';
import useGetCollections from '@/features/shared/api/document-collections/use-get-collections';
import { DocumentUploadStatus } from '@/features/shared/types/document';

const formatDocDate = (value?: Date | string | null): string => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

type RowStatus = 'graphing' | 'graphed' | 'ungraphable' | 'pending' | 'none';

interface DocumentSchemaModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function DocumentSchemaModal({ opened, onClose }: DocumentSchemaModalProps) {
  const { data: systemConfig } = useGetSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const { data: userDocuments } = useGetDocuments({ documentUploadProviderId });
  const { data: graphedDocumentsData } = useGetGraphedDocuments();
  const { data: activeGraphBuilds } = useGetActiveGraphBuilds();
  const { data: userProvidedData } = useGetUserProvidedGraphDocuments();
  const { data: collectionsData } = useGetCollections();

  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collectionsModalDoc, setCollectionsModalDoc] = useState<{ id: string; filename: string; collectionIds: string[] } | null>(null);

  const graphedIds = useMemo(() => new Set(graphedDocumentsData?.documentIds ?? []), [graphedDocumentsData]);
  const ungraphableIds = useMemo(() => new Set(graphedDocumentsData?.ungraphableDocumentIds ?? []), [graphedDocumentsData]);
  const userProvidedIds = useMemo(() => new Set(userProvidedData?.userProvidedDocumentIds ?? []), [userProvidedData]);
  const graphingIds = useMemo(() => {
    const ids = new Set<string>();
    (activeGraphBuilds ?? []).forEach((build) => {
      (build.newDocumentIds ?? build.documentIds).forEach((id) => ids.add(id));
    });
    return ids;
  }, [activeGraphBuilds]);

  // Enrich + filter once; group into folders for display.
  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const enriched = (userDocuments?.documents ?? [])
      .filter((doc) =>
        !query ||
        doc.filename.toLowerCase().includes(query) ||
        (doc.dataProfile?.type ?? '').toLowerCase().includes(query))
      .map((doc) => {
        const status: RowStatus = graphingIds.has(doc.id)
          ? 'graphing'
          : graphedIds.has(doc.id)
            ? 'graphed'
            : ungraphableIds.has(doc.id)
              ? 'ungraphable'
              : doc.uploadStatus !== DocumentUploadStatus.Completed
                ? 'pending'
                : 'none';
        // User-provided graphs (native palm-graph JSON) are ingested as-is and
        // never run through schema-based extraction — schema does not apply.
        const buildType: 'extraction' | 'user-provided' = userProvidedIds.has(doc.id) ? 'user-provided' : 'extraction';
        return {
          doc,
          status,
          buildType,
        };
      })
      .sort((a, b) => a.doc.filename.localeCompare(b.doc.filename));

    const collections = collectionsData?.collections ?? [];
    const result: { id: string; name: string; rows: typeof enriched }[] = [];
    const documentedIds = new Set<string>();

    collections.forEach((collection) => {
      const rows = enriched.filter((row) => row.doc.collections?.some((c) => c.id === collection.id));
      if (rows.length > 0) {
        result.push({ id: collection.id, name: collection.name, rows });
        rows.forEach((row) => documentedIds.add(row.doc.id));
      }
    });

    // Add uncategorized documents
    const uncategorizedRows = enriched.filter((row) => !documentedIds.has(row.doc.id));
    if (uncategorizedRows.length > 0) {
      result.push({ id: 'uncategorized', name: 'Uncategorized', rows: uncategorizedRows });
    }

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDocuments, search, graphingIds, graphedIds, ungraphableIds, userProvidedIds, collectionsData]);

  const totalCount = useMemo(
    () => new Set(groups.flatMap((g) => g.rows.map((r) => r.doc.id))).size,
    [groups],
  );

  const toggleCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <>
    <Modal
      opened={opened}
      onClose={onClose}
      size='90%'
      title={<Text fw={600}>Graph build settings</Text>}
      overlayProps={{ opacity: 0.55, blur: 2 }}
    >
      <Stack spacing='md'>
        <Group position='apart'>
          <TextInput
            placeholder='Search documents…'
            icon={<IconSearch size={14} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            w={280}
            data-testid='schema-table-search'
          />
          <Text size='sm' color='dimmed'>{totalCount} documents</Text>
        </Group>

        {totalCount === 0 ? (
          <Center py='xl'>
            <Text size='sm' color='dimmed'>No documents found.</Text>
          </Center>
        ) : (
          <ScrollArea h='70vh' type='auto'>
            <Table highlightOnHover verticalSpacing='sm'>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Tags</th>
                  <th>Summary</th>
                  <th>Build type</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const collapsed = collapsedGroups.has(group.id);

                  return (
                    <Fragment key={group.id}>
                      <tr data-testid={`schema-group-${group.id}`}>
                        <td
                          colSpan={7}
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleCollapse(group.id)}
                          data-testid={`schema-group-toggle-${group.id}`}
                        >
                          <Group spacing={6} noWrap>
                            <IconChevronRight
                              size={14}
                              style={{ transform: collapsed ? undefined : 'rotate(90deg)', transition: 'transform 150ms ease' }}
                            />
                            <ThemeIcon size='sm' variant='transparent' color='gray.5'>
                              <IconFolder size={16} stroke={1.5} />
                            </ThemeIcon>
                            <Text size='sm' fw={600} color='gray.3'>
                              {group.name} <Text span color='dimmed' fw={400}>({group.rows.length})</Text>
                            </Text>
                          </Group>
                        </td>
                      </tr>
                      {!collapsed && group.rows.map((row) => {
                        const { doc } = row;
                        return (
                          <tr key={`${group.id}-${doc.id}`} data-testid={`schema-row-${doc.id}`}>
                            <td>
                              <Group spacing={6} noWrap align='center'>
                                <Text size='sm' style={{ wordBreak: 'break-word', flex: 1 }}>{doc.filename}</Text>
                                <Tooltip label='Move to folder' withinPortal>
                                  <ActionIcon
                                    size='sm'
                                    variant='subtle'
                                    color='gray'
                                    onClick={() => setCollectionsModalDoc({
                                      id: doc.id,
                                      filename: doc.filename,
                                      collectionIds: (doc.collections ?? []).map((c) => c.id),
                                    })}
                                    data-testid={`move-folder-${doc.id}`}
                                  >
                                    <IconFolderCog size={15} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </td>
                            <td>
                              <Text size='sm' color={doc.dataProfile?.type ? undefined : 'dimmed'}>
                                {doc.dataProfile?.type || '—'}
                              </Text>
                            </td>
                            <td>
                              {/* Tags column deferred until DOCUMENT_METADATA (Branch B) lands. */}
                              <Text size='sm' color='dimmed'>—</Text>
                            </td>
                            <td>
                              {doc.dataProfile?.summary ? (
                                <Tooltip label={doc.dataProfile.summary} multiline width={360} withinPortal>
                                  <Text
                                    size='sm'
                                    color='dimmed'
                                    style={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      maxWidth: 260,
                                    }}
                                    data-testid={`summary-${doc.id}`}
                                  >
                                    {doc.dataProfile.summary}
                                  </Text>
                                </Tooltip>
                              ) : (
                                <Text size='sm' color='dimmed'>—</Text>
                              )}
                            </td>
                            <td>
                              {row.buildType === 'user-provided' ? (
                                <Tooltip label='Ingested as a user-provided graph (no extraction)' withinPortal>
                                  <Badge color='grape' variant='light' radius='sm' leftSection={<IconFileImport size={11} />} styles={{ root: { textTransform: 'none' } }} data-testid={`build-type-${doc.id}`}>
                                    User-provided
                                  </Badge>
                                </Tooltip>
                              ) : (
                                <Badge color='gray' variant='light' radius='sm' styles={{ root: { textTransform: 'none' } }} data-testid={`build-type-${doc.id}`}>
                                  Extraction
                                </Badge>
                              )}
                            </td>
                            <td>
                              {row.status === 'graphing' ? (
                                <Badge color='orange' variant='light'>Graphing</Badge>
                              ) : row.status === 'graphed' ? (
                                <Badge color='blue' variant='light'>Graphed</Badge>
                              ) : row.status === 'ungraphable' ? (
                                <Badge color='gray' variant='light'>Ungraphable</Badge>
                              ) : row.status === 'pending' ? (
                                <Badge color='yellow' variant='light'>Pending</Badge>
                              ) : (
                                <Badge color='gray' variant='outline'>Not graphed</Badge>
                              )}
                            </td>
                            <td>
                              <Text size='sm' color='dimmed'>{formatDocDate(doc.dataProfile?.date)}</Text>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
          </ScrollArea>
        )}
      </Stack>
    </Modal>
    {collectionsModalDoc && (
      <ManageDocumentCollectionsModal
        modalOpened={!!collectionsModalDoc}
        closeModalHandler={() => setCollectionsModalDoc(null)}
        documentId={collectionsModalDoc.id}
        documentFilename={collectionsModalDoc.filename}
        currentCollectionIds={collectionsModalDoc.collectionIds}
      />
    )}
    </>
  );
}
