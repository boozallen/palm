import { useEffect, useMemo, useState } from 'react';
import { Box, Pagination, Stack, Table, Text } from '@mantine/core';

import UserGroupKbProviderRow from './UserGroupKbProviderRow';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import useGetKbProviders from '@/features/settings/api/get-kb-providers';
import Loading from '@/features/shared/components/Loading';
import useGetUserGroupKbProviders from '@/features/settings/api/get-user-group-kb-providers';

type UserGroupKbProvidersTableProps = Readonly<{
  id: string;
}>;

export default function UserGroupKbProvidersTable(
  { id }: UserGroupKbProvidersTableProps
) {

  const {
    data: kbProviders,
    isPending: kbProvidersIsPending,
    error: kbProvidersError,
  } = useGetKbProviders();

  /* IMPLEMENT PAGINATION */
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    if (!kbProviders || !kbProviders.kbProviders.length) {
      return 1;
    }

    return Math.ceil(kbProviders.kbProviders.length / ITEMS_PER_PAGE);
  }, [kbProviders]);

  const paginatedKbProviders = useMemo(() => {
    if (!kbProviders || !kbProviders.kbProviders.length) {
      return [];
    }

    const indexOfFirstKbProvider = (currentPage - 1) * ITEMS_PER_PAGE;
    const indexOfLastKbProvider = currentPage * ITEMS_PER_PAGE;

    return kbProviders.kbProviders.slice(indexOfFirstKbProvider, indexOfLastKbProvider).map(kbProvider => ({
      ...kbProvider,
      updatedAt: new Date(kbProvider.updatedAt),
    }));
  }, [kbProviders, currentPage]);

  /* HANDLE CASE WHERE TOTAL PAGES CHANGES AND CURRENT PAGE IS NO LONGER AVAILABLE */
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleChangePage = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const {
    data: userGroupKbProviders,
    isPending: userGroupKbProvidersIsPending,
    error: userGroupKbProvidersError,
  } = useGetUserGroupKbProviders(id);

  if (kbProvidersIsPending || userGroupKbProvidersIsPending) {
    return <Loading />;
  }

  if (kbProvidersError || userGroupKbProvidersError) {
    const message = kbProvidersError?.message ?? userGroupKbProvidersError?.message;
    return <Text>{message}</Text>;
  }

  if (!kbProviders || !kbProviders.kbProviders.length) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No knowledge base providers have been configured yet.</Text>
      </Box>
    );
  }

  const userGroupKbProvidersIds = userGroupKbProviders?.userGroupKbProviders?.map(({ id }) => id) ?? [];

  return (
    <Stack bg='dark.6' p='xl' spacing='lg'>
      <Table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {paginatedKbProviders.map((kbProvider) => (
            <UserGroupKbProviderRow
              key={kbProvider.id}
              kbProvider={kbProvider}
              userGroupId={id}
              isEnabled={userGroupKbProvidersIds.includes(kbProvider.id)}
            />
          ))}
        </tbody>
      </Table>
      {totalPages > 1 &&
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={handleChangePage}
          data-testid='kb-providers-table-pagination'
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
