import { useEffect, useMemo, useState } from 'react';
import { Box, Pagination, Stack, Table, Text } from '@mantine/core';

import ChecklistItemRow from './ChecklistItemRow';
import useGetSwearChecklistItems from '@/features/settings/api/ai-agents/swear/get-swear-checklist-items';
import Loading from '@/features/shared/components/Loading';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';

type ChecklistItemTableProps = Readonly<{
  aiAgentId: string;
}>;

export default function ChecklistItemTable({ aiAgentId }: ChecklistItemTableProps) {
  const { data: checklistData, isPending: checklistIsPending } =
    useGetSwearChecklistItems(aiAgentId);

  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    if (!checklistData?.checklistItems?.length) {
      return 1;
    }

    return Math.ceil(checklistData.checklistItems.length / ITEMS_PER_PAGE);
  }, [checklistData]);

  const paginatedItems = useMemo(() => {
    if (!checklistData) {
      return [];
    }

    const indexOfFirstItem = (currentPage - 1) * ITEMS_PER_PAGE;
    const indexOfLastItem = currentPage * ITEMS_PER_PAGE;

    return checklistData.checklistItems.slice(indexOfFirstItem, indexOfLastItem);
  }, [currentPage, checklistData]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleChangePage = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (checklistIsPending) {
    return <Loading />;
  }

  if (!checklistData?.checklistItems.length) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No checklist items have been configured yet.</Text>
      </Box>
    );
  }

  return (
    <Stack bg='dark.6' p='md' spacing='lg'>
      <Table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Checklist Item</th>
            <th>Sort Order</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.map((item) => (
            <ChecklistItemRow key={item.id} checklistItem={item} />
          ))}
        </tbody>
      </Table>
      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={handleChangePage}
          data-testid='checklist-items-pagination'
          position='right'
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
    </Stack>
  );
}
