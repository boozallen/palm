import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Pagination, Table, Text, Select, Group } from '@mantine/core';

import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import DocumentLibraryRow from './DocumentLibraryRow';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import useGetCollections from '@/features/shared/api/document-collections/use-get-collections';
import Loading from '@/features/shared/components/Loading';
import { useGetUserGraphDatabaseAccess } from '@/features/shared/api/get-user-graph-database-access';
import { useGetActiveGraphBuilds } from '@/features/graph-database/api/get-active-graph-builds';
import { useGetGraphedDocuments } from '@/features/graph-database/api/get-graphed-documents';
import { trpc } from '@/libs';

export default function DocumentLibraryTable() {
  const systemConfig = useGetSystemConfig();
  const documentUploadProviderId = systemConfig.data?.documentLibraryDocumentUploadProviderId || '';

  const { data, isLoading } = useGetDocuments({ documentUploadProviderId });
  const { data: collectionsData } = useGetCollections();
  const { data: graphAccessData } = useGetUserGraphDatabaseAccess();
  const { data: activeBuildsData } = useGetActiveGraphBuilds();
  const { data: graphedDocumentsData } = useGetGraphedDocuments();

  const utils = trpc.useUtils();

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const hasGraphAccess = graphAccessData?.hasAccess ?? false;
  const graphedDocumentIds: string[] = graphedDocumentsData?.documentIds ?? [];
  const ungraphableDocumentIds: string[] = graphedDocumentsData?.ungraphableDocumentIds ?? [];
  const graphingDocumentIds: string[] = (activeBuildsData ?? []).flatMap(b => (b.newDocumentIds ?? b.documentIds) as string[]);

  // When active builds drop to zero after having been non-zero, a build just
  // completed — refresh graphed documents so the icon state updates.
  const prevBuildCount = useRef(0);
  useEffect(() => {
    const currentCount = activeBuildsData?.length ?? 0;
    if (prevBuildCount.current > 0 && currentCount === 0) {
      utils.graph.getGraphedDocuments.invalidate();
    }
    prevBuildCount.current = currentCount;
  }, [activeBuildsData, utils]);

  const userDocuments = data ? data.documents : [];
  const allDocuments = userDocuments.map((document) => ({
    ...document,
    createdAt: new Date(document.createdAt),
  }));

  // Filter documents by selected collection
  const documents = useMemo(() => {
    if (!selectedCollectionId) {
      return allDocuments;
    }
    return allDocuments.filter((doc) =>
      doc.collections?.some((c) => c.id === selectedCollectionId)
    );
  }, [allDocuments, selectedCollectionId]);

  const collections = collectionsData?.collections || [];
  const collectionOptions = [
    { value: '', label: 'All Documents' },
    ...collections.map((c) => ({ value: c.id, label: c.name })),
  ];

  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    if (!documents.length) {
      return 1;
    }
    return Math.ceil(documents.length / ITEMS_PER_PAGE);
  }, [documents]);

  const paginatedUserDocuments = useMemo(() => documents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE
  ), [documents, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (isLoading) {
    return <Loading />;
  }

  const hasDocuments = allDocuments.length > 0;
  const hasFilteredResults = documents.length > 0;

  if (!hasDocuments) {
    return (
      <Box bg='dark.8' p='md'>
        <Text>No documents have been uploaded yet.</Text>
      </Box>
    );
  }

  return (
    <>
      {collections.length > 0 && (
        <Group mb='md'>
          <Select
            placeholder='Filter by collection'
            value={selectedCollectionId || ''}
            onChange={(value) => setSelectedCollectionId(value || null)}
            data={collectionOptions}
            clearable
            style={{ width: 250 }}
          />
        </Group>
      )}

      {!hasFilteredResults ? (
        <Box bg='dark.8' p='md'>
          <Text>No documents in this collection.</Text>
        </Box>
      ) : (
        <>
          <Table data-testid='user-document-library-table'>
        <thead>
          <tr>
            <th>Name</th>
            <th>Date Uploaded</th>
            <th>Upload Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedUserDocuments.map((document) => (
            <DocumentLibraryRow
              key={document.id}
              document={document}
              hasGraphAccess={hasGraphAccess}
              isGraphed={graphedDocumentIds.includes(document.id)}
              isGraphing={graphingDocumentIds.includes(document.id)}
              isUngraphable={ungraphableDocumentIds.includes(document.id)}
            />
          ))}
        </tbody>
          </Table>
          {totalPages > 1 && (
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={setCurrentPage}
              position='right'
              data-testid='document-pagination'
              getControlProps={(control) => {
                switch (control) {
                  case 'previous':
                    return { 'aria-label': 'Previous' };
                  case 'next':
                    return { 'aria-label': 'Next' };
                  default:
                    return {};
                }
              }}
            />
          )}
        </>
      )}
    </>
  );
}
