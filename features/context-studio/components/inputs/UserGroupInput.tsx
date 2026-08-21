import { Select } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import useGetUserGroups from '@/features/context-studio/api/get-user-groups';
import { ContextStudioQuery } from '@/features/context-studio/types/context-studio';

type UserGroupInputProps = Readonly<{
  form: UseFormReturnType<ContextStudioQuery>;
}>;

export default function UserGroupInput({ form }: UserGroupInputProps) {
  // The studio's own lookup rather than the Settings one, which is gated to
  // Admins and group Leads and so left this select empty and disabled for the
  // plain members the Context Studio grant admits.
  const { data } = useGetUserGroups();

  const userGroupsData = data?.userGroups?.map((ug) => ({
    value: ug.id,
    label: ug.label,
  })) ?? [];

  if (userGroupsData.length > 0) {
    userGroupsData.unshift({ value: 'all', label: 'All groups' });
  }

  return (
    <Select
      label='User Group'
      mb='0'
      placeholder={userGroupsData.length > 0 ? 'Select user group' : 'No groups available'}
      data={userGroupsData}
      disabled={userGroupsData.length === 0}
      nothingFound='No user groups available'
      data-testid='context-studio-user-group-input'
      {...form.getInputProps('userGroupId')}
    />
  );
}
