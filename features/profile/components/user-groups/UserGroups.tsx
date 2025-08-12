import { Title, Stack, Group } from '@mantine/core';
import UserGroupsTable from './table/UserGroupsTable';
import JoinUserGroupForm from '../forms/JoinUserGroupForm';

export default function UserGroups() {
  return (
    <Stack spacing='md' p='xl' bg='dark.6'>
      <Group position='apart'>
        <Title weight='bold' color='gray.6' order={2}>
          My User Groups
        </Title>
        <JoinUserGroupForm />
      </Group>
      <UserGroupsTable />
    </Stack>
  );
};

