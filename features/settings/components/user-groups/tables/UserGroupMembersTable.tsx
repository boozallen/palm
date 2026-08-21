import {
  ActionIcon,
  Box,
  Group,
  Stack,
  Table,
  Text,
  Title,
  Pagination,
} from '@mantine/core';
import UserGroupMembersTableHead from './UserGroupMembersTableHead';
import UserGroupMembersTableBody from './UserGroupMembersTableBody';
import useGetUserGroupMemberships from '@/features/settings/api/user-groups/get-user-group-memberships';
import Loading from '@/features/shared/components/Loading';
import { IconCirclePlus } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import AddUserGroupMemberModal from '@/features/settings/components/user-groups/modals/AddUserGroupMemberModal';
import { useState, useMemo, useEffect, JSX } from 'react';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import UserGroupJoinCode from '@/features/settings/components/user-groups/elements/UserGroupJoinCode';
import SearchBar from '@/features/shared/components/SearchBar';

type UserGroupsMembersTableProps = Readonly<{
  id: string;
  joinCode: string | null | undefined;
}>;

export default function UserGroupMembersTable({
  id,
  joinCode,
}: UserGroupsMembersTableProps): JSX.Element {
  const [
    addUserGroupMemberModalOpened,
    { open: openAddUserGroupMemberModal, close: closeAddUserGroupMemberModal },
  ] = useDisclosure(false);

  const {
    data: userGroupMembers,
    isPending: userGroupMembersIsPending,
    error: userGroupMembersError,
  } = useGetUserGroupMemberships({ id });

  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 500);

  const [currentPage, setCurrentPage] = useState(1);

  const filteredMembers = useMemo(() => {
    if (!userGroupMembers) {
      return [];
    }

    if (!debouncedSearchQuery) {
      return userGroupMembers.userGroupMemberships;
    }

    const query = debouncedSearchQuery.toLowerCase();
    return userGroupMembers.userGroupMemberships.filter(
      (member) =>
        member.name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query)
    );
  }, [userGroupMembers, debouncedSearchQuery]);

  const totalPages = useMemo(() => {
    if (filteredMembers.length === 0) {
      return 1;
    }
    return Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  }, [filteredMembers]);

  const handleChangePage = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const paginatedMembers = useMemo(
    () =>
      filteredMembers
        .slice(
          (currentPage - 1) * ITEMS_PER_PAGE,
          currentPage * ITEMS_PER_PAGE
        )
        .map(member => ({
          ...member,
          lastLoginAt: member.lastLoginAt ? new Date(member.lastLoginAt) : null,
        })),
    [filteredMembers, currentPage]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  if (userGroupMembersIsPending) {
    return <Loading />;
  }

  if (userGroupMembersError) {
    return <Text>{userGroupMembersError.message}</Text>;
  }

  return (
    <>
      <Group spacing='apart' grow mb='md'>
        <Group>
          <Title weight='bold' color='gray.6' order={2}>
            Add Member
          </Title>
          <ActionIcon
            variant='system_management'
            data-testid='add-user-group-member-button'
            onClick={openAddUserGroupMemberModal}
            aria-label='Add member'
          >
            <IconCirclePlus />
          </ActionIcon>
        </Group>

        <UserGroupJoinCode id={id} currentJoinCode={joinCode} />
      </Group>

      {!userGroupMembers ||
      userGroupMembers.userGroupMemberships.length === 0 ? (
        <Box bg='dark.8' p='md'>
          <Text>No members have been added yet.</Text>
        </Box>
      ) : (
        <>
          <Group position='apart' mb='md'>
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchFocused={searchFocused}
              setSearchFocused={setSearchFocused}
              placeholder='Search members'
            />
            <Text align='right' c='gray.6' fz='md'>
              {debouncedSearchQuery.length === 0
                ? 'Results: '
                : `Results for "${debouncedSearchQuery}" : `}
              {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'}
            </Text>
          </Group>
          {filteredMembers.length === 0 ? (
            <Box bg='dark.8' p='md'>
              <Text>No members match your search.</Text>
            </Box>
          ) : (
            <Stack bg='dark.6' p='md' spacing='lg'>
              <Table data-testid='user-group-members-table'>
                <UserGroupMembersTableHead />
                <UserGroupMembersTableBody userGroupMembers={paginatedMembers} />
              </Table>
              {totalPages > 1 && (
                <Pagination
                  total={totalPages}
                  value={currentPage}
                  onChange={handleChangePage}
                  position='right'
                  data-testid='pagination'
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
          )}
        </>
      )}

      <AddUserGroupMemberModal
        modalOpen={addUserGroupMemberModalOpened}
        closeModalHandler={closeAddUserGroupMemberModal}
        id={id}
      />
    </>
  );
}
