import { Box, Table, Text } from '@mantine/core';
import Loading from '@/features/shared/components/Loading';
import useGetGitHubProviders from '@/features/settings/api/github-providers/get-github-providers';
import GitHubProvidersTableHead from './GitHubProvidersTableHead';
import GitHubProvidersTableBody from './GitHubProvidersTableBody';
import { JSX } from 'react';

const TableWrapper = ({ children }: { children: JSX.Element }): JSX.Element => {
  return (
    <table>
      <tbody>
        <tr>
          <td>{children}</td>
        </tr>
      </tbody>
    </table>
  );
};

export default function GitHubProvidersTable() {
  const {
    data: githubProvidersData,
    isPending,
    error,
  } = useGetGitHubProviders();

  if (isPending) {
    return (
      <TableWrapper>
        <Loading />
      </TableWrapper>
    );
  }

  if (error) {
    return (
      <TableWrapper>
        <Text>{error.message}</Text>
      </TableWrapper>
    );
  }

  if (!githubProvidersData.githubProviders || githubProvidersData.githubProviders.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No GitHub Providers have been configured yet.</Text>
      </Box>
    );
  }

  return (
    <Box bg='dark.6' p='md'>
      <Table data-testid='github-providers-table'>
        <GitHubProvidersTableHead />
        <GitHubProvidersTableBody githubProviders={githubProvidersData.githubProviders} />
      </Table>
    </Box>
  );
}
