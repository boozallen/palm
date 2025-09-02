import { Box, Table, Text } from '@mantine/core';
import UserGroupAiProvidersTableHead from './UserGroupAiProvidersTableHead';
import UserGroupAiProvidersTableBody from './UserGroupAiProvidersTableBody';
import useGetAiProviders from '@/features/settings/api/ai-providers/get-ai-providers';
import useGetUserGroupAiProviders from '@/features/settings/api/user-groups/get-user-group-ai-providers';
import Loading from '@/features/shared/components/Loading';
import { JSX } from 'react';

type UserGroupAiProviderTableProps = Readonly<{
  id: string;
}>;
export default function UserGroupAiProvidersTable({ id }: UserGroupAiProviderTableProps): JSX.Element {

  const {
    data: aiProviders,
    isPending: aiProvidersIsPending,
    error: aiProvidersError,
  } = useGetAiProviders();

  const {
    data: userGroupAiProviders,
    isPending: userGroupAiProvidersIsPending,
    error: userGroupAiProvidersError,
  } = useGetUserGroupAiProviders(id);

  if (aiProvidersIsPending || userGroupAiProvidersIsPending) {
    return <Loading />;
  }

  if (aiProvidersError) {
    return <Text>{aiProvidersError.message}</Text>;
  }
  else if (userGroupAiProvidersError) {
    return <Text>{userGroupAiProvidersError.message}</Text>;
  }

  if (!aiProviders.aiProviders || aiProviders.aiProviders.length === 0) {

    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No AI Providers have been configured yet.</Text>
      </Box>
    );
  }

  const userGroupAiProviderIds = userGroupAiProviders?.userGroupProviders.map(provider => provider.id) || [];

  return (
    <Box bg='dark.6' p='xl'>
      <Table data-testid='user-group-ai-providers-table'>
        <UserGroupAiProvidersTableHead />
        <UserGroupAiProvidersTableBody
          aiProviders={aiProviders.aiProviders}
          userGroupAiProviders={userGroupAiProviderIds}
          userGroupId={id}
        />
      </Table>
    </Box>
  );
}
