import { useState } from 'react';
import { Select, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import useGetUsersListWithRole from '@/features/settings/api/admins/get-users-list-with-role';
import { SelectedUser } from '@/features/settings/types';

export type UserGroupsUserFilterProps = Readonly<{
  selectedUser: SelectedUser | null;
  onSelectedUserChange: (user: SelectedUser | null) => void;
}>;

export default function UserGroupsUserFilter({
  selectedUser,
  onSelectedUserChange,
}: UserGroupsUserFilterProps) {
  const [query, setQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(query, 500);

  const { data: usersList, error: usersListError } = useGetUsersListWithRole({
    searchQuery: debouncedSearchQuery,
    userId: selectedUser?.id,
  });

  if (usersListError) {
    return <Text>{usersListError.message}</Text>;
  }

  const userData =
    usersList?.users.map((user) => ({
      value: user.id,
      label: `${user.name} (${user.email ?? 'N/A'})`,
    })) ?? [];

  const handleChange = (value: string | null) => {
    if (value === null || value.length === 0) {
      onSelectedUserChange(null);
      return;
    }

    const user = usersList?.users.find((listUser) => listUser.id === value);

    onSelectedUserChange(user ? { id: user.id, name: user.name } : null);
  };

  return (
    <Select
      label='Find user'
      data-testid='user-groups-user-filter'
      placeholder='Search by name or email'
      searchable={!selectedUser}
      clearable
      limit={5}
      data={userData}
      nothingFound={query.length >= 1 ? 'No users found' : undefined}
      onSearchChange={setQuery}
      value={selectedUser?.id ?? ''}
      onChange={handleChange}
      clearButtonProps={{ 'aria-label': 'Clear selected user' }}
    />
  );
}
