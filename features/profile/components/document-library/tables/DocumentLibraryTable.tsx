import { useEffect, useMemo, useState } from 'react';
import { Box, Pagination, Table, Text } from '@mantine/core';

import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import DocumentLibraryRow from './DocumentLibraryRow';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import Loading from '@/features/shared/components/Loading';

export default function DocumentLibraryTable() {
  const systemConfig = useGetSystemConfig();
  const documentUploadProviderId = systemConfig.data?.documentLibraryDocumentUploadProviderId || '';

  const { data, isLoading } = useGetDocuments({
    documentUploadProviderId,
  });

  const userDocuments = data ? data.documents : [];
  const documents = userDocuments.map((document) => ({
    ...document,
    createdAt: new Date(document.createdAt),
  }));

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

  if (!documents.length) {
    return (
      <Box bg='dark.8' p='md'>
        <Text>No documents have been uploaded yet.</Text>
      </Box>
    );
  }

  return (
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
  );
}
