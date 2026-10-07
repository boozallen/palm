import { JSX } from 'react';
import { Box, Table, Text } from '@mantine/core';
import useGetTemplates from '@/features/settings/api/templates/get-templates';
import useGetUserGroupArtifactTemplates from '@/features/settings/api/user-groups/get-user-group-artifact-templates';
import UserGroupArtifactTemplatesTableHead from './UserGroupArtifactTemplatesTableHead';
import UserGroupArtifactTemplatesTableBody from './UserGroupArtifactTemplatesTableBody';
import Loading from '@/features/shared/components/Loading';

type UserGroupArtifactTemplatesTableProps = Readonly<{
  id: string;
}>;

export default function UserGroupArtifactTemplatesTable({ id }: UserGroupArtifactTemplatesTableProps): JSX.Element {
  const {
    data: templatesData,
    isPending: templatesIsPending,
    error: templatesError,
  } = useGetTemplates();

  const {
    data: userGroupTemplatesData,
    isPending: userGroupTemplatesIsPending,
    error: userGroupTemplatesError,
  } = useGetUserGroupArtifactTemplates(id);

  if (templatesIsPending || userGroupTemplatesIsPending) {
    return <Loading />;
  }

  if (templatesError) {
    return <Text>{templatesError.message}</Text>;
  }

  if (userGroupTemplatesError) {
    return <Text>{userGroupTemplatesError.message}</Text>;
  }

  if (!templatesData.templates || templatesData.templates.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No Artifact Templates have been configured yet.</Text>
      </Box>
    );
  }

  const userGroupTemplateIds = userGroupTemplatesData?.userGroupTemplates.map((t) => t.id) ?? [];

  return (
    <Box bg='dark.6' p='md'>
      <Table data-testid='user-group-artifact-templates-table'>
        <UserGroupArtifactTemplatesTableHead />
        <UserGroupArtifactTemplatesTableBody
          templates={templatesData.templates}
          userGroupTemplateIds={userGroupTemplateIds}
          userGroupId={id}
        />
      </Table>
    </Box>
  );
}
