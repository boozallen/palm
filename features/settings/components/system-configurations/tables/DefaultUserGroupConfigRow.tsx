import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import useGetUserGroups from '@/features/settings/api/user-groups/get-user-groups';
import Loading from '@/features/shared/components/Loading';
import { Grid, Select, Text } from '@mantine/core';
import { SystemConfigFields } from '@/features/shared/types';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck } from '@tabler/icons-react';

interface DefaultUserGroupConfigRowProps {
  defaultUserGroupId: string | null;
}

const DefaultUserGroupConfigRow = ({ defaultUserGroupId }: DefaultUserGroupConfigRowProps) => {

  const {
    data: userGroupData,
    isPending: userGroupsIsPending,
    error: userGroupsError,
  } = useGetUserGroups();

  const { mutateAsync: updateSystemConfig, error: updateSystemConfigError } = useUpdateSystemConfig();

  const noneOption = { value: '', label: '(None)' };

  const userGroups =
    userGroupData?.userGroups.map((group) => ({
      value: group.id,
      label: group.label,
    })) || [];

  const selectOptions = userGroups.length > 0 ? [noneOption, ...userGroups] : [];

  const defaultValue = defaultUserGroupId ?? '';

  if (userGroupsIsPending) {
    return (
      <tr>
        <td colSpan={2}>
          <Loading />
        </td>
      </tr>
    );
  }

  if (userGroupsError) {
    return (
      <tr>
        <td colSpan={2}>
          <Text>{userGroupsError.message}</Text>
        </td>
      </tr>
    );
  }

  const handleGroupChange = async (value: string) => {
    let updateSuccessful = true;
    let successMessage = '';

    try {
      await updateSystemConfig({
        configField: SystemConfigFields.DefaultUserGroupId,
        configValue: value === '' ? null : value,
      });
      successMessage = value.length ? 'Default user group has been updated.' : 'Default user group has been removed.';
    } catch (error) {
      updateSuccessful = false;
    }

    notifications.show({
      id: 'update-default-user-group',
      title: updateSuccessful ? 'Default User Group Updated' : 'Failed to Update',
      message: updateSuccessful
        ? successMessage
        : updateSystemConfigError?.message ??
        'Could not update default user group.',
      icon: updateSuccessful ? <IconCheck /> : <IconX />,
      variant: updateSuccessful ? 'successful_operation' : 'failed_operation',
      autoClose: updateSuccessful,
    });
  };

  return (
    <tr data-testid='default-user-group-config-row'>
      <td colSpan={2}>
        <Grid>
          <Grid.Col span={6}>
            <Select
              variant='default'
              label='Select Default User Group'
              data-testid='default-user-group-select'
              data={selectOptions}
              value={userGroups.length > 0 ? defaultValue : null}
              placeholder='No user groups available'
              onChange={handleGroupChange}
              disabled={!userGroups.length}
            ></Select>
          </Grid.Col>
        </Grid>
      </td>
    </tr>
  );
};
export default DefaultUserGroupConfigRow;
