import { Dispatch, LegacyRef, SetStateAction, forwardRef, useState } from 'react';
import { Button, Group, Select, Text } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import {
  UserGroupMemberForm,
  userGroupMemberFormSchema,
  UserGroupRoleInputOptions,
  UserGroupRole,
} from '@/features/shared/types/user-group';
import useCreateUserGroupMembership from '@/features/settings/api/user-groups/create-user-group-membership';
import useGetUsersListWithGroupMembershipStatus from '@/features/settings/api/user-groups/get-users-list-with-group-membership-status';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';

export type AddUserGroupMemberFormProps = Readonly<{
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
  id: string;
}>;

interface ItemProps extends React.ComponentPropsWithoutRef<'div'> {
  label: string;
  description: string;
  disabled: boolean;
}

const SelectItem = forwardRef<HTMLDivElement, ItemProps>(
  ({ label, description, disabled, ...others }: ItemProps, ref: LegacyRef<HTMLDivElement> | undefined) => (
    <div ref={ref} {...others}>
      <Group noWrap>

        <div>
          <Text size='sm' color={disabled ? 'gray.7' : 'gray.2'}>{label}</Text>
          <Text size='xs' color='gray.7' opacity={0.65}>
            {description}
          </Text>
        </div>
      </Group>
    </div>
  )
);
SelectItem.displayName = 'SelectItem';

export default function AddUserGroupMemberForm({ setFormCompleted, id }: AddUserGroupMemberFormProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(query, 500);

  const {
    data: usersListWithGroupMembershipStatus,
    error: usersListWithGroupMembershipStatusIsError,
  } = useGetUsersListWithGroupMembershipStatus({
    userGroupId: id,
    userId: selectedUserId,
    searchQuery: debouncedSearchQuery,
  });

  const {
    mutateAsync: createUserGroupMember,
    isPending: createUserGroupMemberIsPending,
    error: createUserGroupMemberError,
  } = useCreateUserGroupMembership();

  const addUserGroupMemberForm = useForm<UserGroupMemberForm>({
    initialValues: {
      userId: '',
      role: UserGroupRole.User,
    },
    validate: zodResolver(userGroupMemberFormSchema),
  });

  if (usersListWithGroupMembershipStatusIsError) {
    return <Text>{usersListWithGroupMembershipStatusIsError?.message}</Text>;
  }

  const userData =
    usersListWithGroupMembershipStatus?.usersGroupMembershipStatus.map((user) => ({
      value: user.id,
      label: `${user.name} (${user.email ?? 'N/A'})`,
      description: user.isMember ? 'Already a member' : '',
      disabled: user.isMember,
    })) ?? [];

  const handleUserSelectChange = (value: string | null) => {
    if (value === null || value.length === 0) {
      setSelectedUserId(undefined);
      addUserGroupMemberForm.setFieldValue('userId', '');
    } else {
      setSelectedUserId(value);
      addUserGroupMemberForm.setFieldValue('userId', value);
    }
  };

  const handleSubmit = async (values: UserGroupMemberForm) => {
    try {
      await createUserGroupMember({
        userId: values.userId,
        role: values.role,
        userGroupId: id,
      });
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        id: 'create-user-group-member-failed',
        title: 'Failed to Add User Group Member',
        message:
          createUserGroupMemberError?.message ||
          'Unable to add member. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const handleFormCompletion = () => {
    addUserGroupMemberForm.reset();
    setFormCompleted(true);
  };

  return (
    <form
      onSubmit={addUserGroupMemberForm.onSubmit(handleSubmit)}
      data-testid='add-user-group-member-form'
    >
      <Select
        label='User'
        placeholder='Search by name or email'
        searchable={!selectedUserId}
        clearable
        limit={5}
        itemComponent={SelectItem}
        data={userData}
        nothingFound={query.length >= 1 ? 'No users found' : undefined}
        onSearchChange={setQuery}
        {...addUserGroupMemberForm.getInputProps('userId')}
        value={selectedUserId ?? ''}
        onChange={handleUserSelectChange}
      />
      <Select
        label='Role'
        placeholder='Select user role'
        data={UserGroupRoleInputOptions}
        {...addUserGroupMemberForm.getInputProps('role')}
      />

      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button
          type='submit'
          loading={createUserGroupMemberIsPending}
          disabled={!addUserGroupMemberForm.isValid()}
        >
          {createUserGroupMemberIsPending ? 'Adding User' : 'Add User'}
        </Button>
      </Group>
    </form>
  );
}
