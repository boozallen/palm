import { Select } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import useGetUserGroupMembers from '@/features/context-studio/api/get-user-group-members';
import { ContextStudioQuery } from '@/features/context-studio/types/context-studio';

type UserInputProps = Readonly<{
  form: UseFormReturnType<ContextStudioQuery>;
}>;

export default function UserInput({ form }: UserInputProps) {
  const userGroupId = form.values.userGroupId;
  const isGroupSelected = userGroupId !== 'all';

  // The studio's own lookup rather than the Settings one, which is gated to Leads
  // of the requested group and so left this select empty for anyone else.
  const { data, isLoading } = useGetUserGroupMembers(userGroupId, isGroupSelected);

  const usersData = data?.members?.map((m) => ({
    value: m.userId,
    label: m.name,
  })) ?? [];

  if (usersData.length > 0) {
    usersData.unshift({ value: 'all', label: 'All users' });
  }

  const placeholder = !isGroupSelected
    ? 'Select a user'
    : isLoading
      ? 'Loading...'
      : 'Select user';

  return (
    <Select
      label='User'
      mb='0'
      placeholder={placeholder}
      data={usersData}
      disabled={!isGroupSelected || isLoading}
      searchable
      nothingFound='No users found'
      data-testid='context-studio-user-input'
      {...form.getInputProps('userId')}
    />
  );
}
