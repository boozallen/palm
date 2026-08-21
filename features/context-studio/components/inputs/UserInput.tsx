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
  const { data } = useGetUserGroupMembers(userGroupId, isGroupSelected);

  const usersData = data?.members?.map((m) => ({
    value: m.userId,
    label: m.name,
  })) ?? [];

  if (usersData.length > 0) {
    usersData.unshift({ value: 'all', label: 'All users' });
  }

  return (
    <Select
      label='User'
      mb='0'
      // Options are the selected group's members, so this stays disabled until a
      // group is chosen. The placeholder has to say so, or a permanently greyed
      // control with no options reads as broken.
      placeholder={isGroupSelected ? 'Select user' : 'Select a user group first'}
      data={usersData}
      disabled={!isGroupSelected}
      searchable
      nothingFound='No users found'
      data-testid='context-studio-user-input'
      {...form.getInputProps('userId')}
    />
  );
}
