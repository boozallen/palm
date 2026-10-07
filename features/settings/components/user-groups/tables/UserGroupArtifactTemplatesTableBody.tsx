import UserGroupArtifactTemplateRow from './UserGroupArtifactTemplateRow';

type UserGroupArtifactTemplatesTableBodyProps = Readonly<{
  templates: {
    id: string;
    filename: string;
  }[];
  userGroupTemplateIds: string[];
  userGroupId: string;
}>;

export default function UserGroupArtifactTemplatesTableBody({
  templates,
  userGroupTemplateIds,
  userGroupId,
}: UserGroupArtifactTemplatesTableBodyProps) {
  return (
    <tbody data-testid='user-group-artifact-templates-table-body'>
      {templates.map((template) => (
        <UserGroupArtifactTemplateRow
          key={template.id}
          template={template}
          userGroupId={userGroupId}
          isEnabled={userGroupTemplateIds.includes(template.id)}
        />
      ))}
    </tbody>
  );
}
