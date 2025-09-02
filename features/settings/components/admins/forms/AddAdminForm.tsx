import { Dispatch, LegacyRef, SetStateAction, forwardRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Group, Select, Text } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useGetUsersListWithRole from '@/features/settings/api/admins/get-users-list-with-role';
import { addAdminFormSchema, AddAdminFormValues, UserRole } from '@/features/shared/types/user';
import useUpdateUserRole from '@/features/settings/api/admins/update-user-role';

export type AddAdminFormProps = Readonly<{
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
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

export default function AddAdminForm({ setFormCompleted }: AddAdminFormProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(query, 500);
  const session = useSession();

  const currentUserId = session.data?.user.id;

  const {
    data: getUsersListWithRole,
    error: getUsersListWithRoleIsError,
  } = useGetUsersListWithRole({
    userId: selectedUserId,
    searchQuery: debouncedSearchQuery,
  });

  const {
    mutateAsync: updateUserRole,
    isPending: updateUserRoleIsPending,
    error: updateUserRoleError,
  } = useUpdateUserRole();

  const addAdminForm = useForm<AddAdminFormValues>({
    initialValues: {
      userId: '',
    },
    validate: zodResolver(addAdminFormSchema),
  });

  if (getUsersListWithRoleIsError) {
    return <Text>{getUsersListWithRoleIsError?.message}</Text>;
  }

  const userData = getUsersListWithRole?.users.map((user) => {

    const disableUser = user.role === UserRole.Admin || user.id === currentUserId;

    return {
      value: user.id,
      label: `${user.name} (${user.email ?? 'N/A'})`,
      description: disableUser ? 'Already an admin' : '',
      disabled: disableUser,
    };
  }) ?? [];

  const handleUserSelectChange = (value: string | null) => {
    if (value === null || value.length === 0) {
      setSelectedUserId(undefined);
      addAdminForm.setFieldValue('userId', '');
    } else {
      setSelectedUserId(value);
      addAdminForm.setFieldValue('userId', value);
    }
  };

  const handleSubmit = async (values: AddAdminFormValues) => {
    try {
      await updateUserRole({
        id: values.userId,
        role: UserRole.Admin,
      });
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        id: 'update-user-role-failed',
        title: 'Failed to Update User Role',
        message:
          updateUserRoleError?.message ||
          'Unable to update user role at this time. Please try again later.',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleFormCompletion = () => {
    addAdminForm.reset();
    setFormCompleted(true);
  };

  return (
    <form
      onSubmit={addAdminForm.onSubmit(handleSubmit)}
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
        dropdownPosition='bottom'
        nothingFound={query.length >= 1 ? 'No users found' : undefined}
        onSearchChange={setQuery}
        {...addAdminForm.getInputProps('userId')}
        value={selectedUserId ?? ''}
        onChange={handleUserSelectChange}
      />

      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button type='submit' loading={updateUserRoleIsPending}>
          {updateUserRoleIsPending ? 'Adding Admin' : 'Add Admin'}
        </Button>
      </Group>
    </form>
  );
}
