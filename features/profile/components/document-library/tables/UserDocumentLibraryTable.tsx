import { useEffect, useMemo, useState } from 'react';
import { Box, Pagination, Table, Text } from '@mantine/core';

import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import UserDocumentLibraryRow from './UserDocumentLibraryRow';

export default function UserDocumentLibraryTable() {

  // TMP: Replace with GET endpoint
  const userDocuments = Array.from({ length: 11 }, (_, i) => ({
    id: `faux-doc-${i}`,
    userId: 'c59e8e1f-b242-437b-99e1-fe07d67b4d24',
    label: `Faux Doc ${i}`,
    uploadedAt: '2024-10-10T12:00:00.000',
  }));

  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    if (!userDocuments.length) {
      return 1;
    }
    return Math.ceil(userDocuments.length / ITEMS_PER_PAGE);
  }, [userDocuments]);

  const paginatedUserDocuments = useMemo(() => userDocuments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE
  ), [userDocuments, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Add loading and error handling for GET endpoint
  // if (userDocumentsIsLoading) {...}

  if (!userDocuments.length) {
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedUserDocuments.map((document) => (
            <UserDocumentLibraryRow
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
