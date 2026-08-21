import { Box, Table, Text } from '@mantine/core';
import UserGroupGitHubProvidersTableHead from './UserGroupGitHubProvidersTableHead';
import UserGroupGitHubProvidersTableBody from './UserGroupGitHubProvidersTableBody';
import useGetGitHubProviders from '@/features/settings/api/github-providers/get-github-providers';
import useGetUserGroupGitHubProviders from '@/features/settings/api/user-groups/get-user-group-github-providers';
import Loading from '@/features/shared/components/Loading';
import { JSX } from 'react';

type UserGroupGitHubProvidersTableProps = Readonly<{
  id: string;
}>;

export default function UserGroupGitHubProvidersTable({ id }: UserGroupGitHubProvidersTableProps): JSX.Element {

  const {
    data: githubProviders,
    isPending: githubProvidersIsPending,
    error: githubProvidersError,
  } = useGetGitHubProviders();

  const {
    data: userGroupGitHubProviders,
    isPending: userGroupGitHubProvidersIsPending,
    error: userGroupGitHubProvidersError,
  } = useGetUserGroupGitHubProviders(id);

  if (githubProvidersIsPending || userGroupGitHubProvidersIsPending) {
    return <Loading />;
  }

  if (githubProvidersError) {
    return <Text>{githubProvidersError.message}</Text>;
  }
  else if (userGroupGitHubProvidersError) {
    return <Text>{userGroupGitHubProvidersError.message}</Text>;
  }

  if (!githubProviders.githubProviders || githubProviders.githubProviders.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No GitHub Providers have been configured yet.</Text>
      </Box>
    );
  }

  const userGroupGitHubProviderIds = userGroupGitHubProviders?.userGroupGitHubProviders.map(provider => provider.id) || [];

  return (
    <Box bg='dark.6' p='md'>
      <Table data-testid='user-group-github-providers-table'>
        <UserGroupGitHubProvidersTableHead />
        <UserGroupGitHubProvidersTableBody
          githubProviders={githubProviders.githubProviders}
          userGroupGitHubProviders={userGroupGitHubProviderIds}
          userGroupId={id}
        />
      </Table>
    </Box>
  );
}
