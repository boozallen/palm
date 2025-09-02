import { useEffect, useMemo, useState } from 'react';
import { Box, Pagination, Stack, Table, Text } from '@mantine/core';

import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import useGetSystemAdmins from '@/features/settings/api/admins/get-system-admins';
import Loading from '@/features/shared/components/Loading';
import AdminsRow from './AdminsRow';

export default function AdminsTable() {

  const {
    data: systemAdmins,
    isPending: systemAdminsIsPending,
    error: systemAdminsError,
  } = useGetSystemAdmins();

  /* IMPLEMENT PAGINATION */
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    if (!systemAdmins || systemAdmins.admins.length === 0) {
      return 1;
    }

    return Math.ceil(systemAdmins.admins.length / ITEMS_PER_PAGE);
  }, [systemAdmins]);

  const paginatedUsers = useMemo(() => {
    if (!systemAdmins) {
      return [];
    }

    const indexofFirstMember = (currentPage - 1) * ITEMS_PER_PAGE;
    const indexOfLastMember = currentPage * ITEMS_PER_PAGE;

    return systemAdmins.admins.slice(indexofFirstMember, indexOfLastMember);
  }, [currentPage, systemAdmins]);

  /* HANDLE CASE WHERE TOTAL PAGES CHANGES AND CURRENT PAGE IS NO LONGER AVAILABLE */
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleChangePage = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (systemAdminsIsPending) {
    return <Loading />;
  }

  if (systemAdminsError) {
    return <Text>{systemAdminsError.message}</Text>;
  }

  if (!systemAdmins || systemAdmins.admins.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No admins found in DB.</Text>
      </Box>
    );
  }

  return (
    <Stack bg='dark.6' p='xl' spacing='lg'>
      <Text>
        Note: Does not include users who are granted admin-level privileges solely through their SSO provider
      </Text>
      <Table data-testid='admins-table'>
        <thead>
          <tr>
            <th>Name</th>
            <th colSpan={2}>Email</th>
          </tr>
        </thead>
        <tbody>
          {paginatedUsers.map((admin) => (
            <AdminsRow
              key={admin.id}
              id={admin.id}
              name={admin.name}
              email={admin.email ?? 'N/A'}
            />
          ))}
        </tbody>
      </Table>
      {totalPages > 1 &&
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={handleChangePage}
          data-testid='admins-pagination'
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
      }
    </Stack>
  );
}
