import UserGroupAiProviderRow from './UserGroupAiProviderRow';

type UserGroupAiProvidersTableBodyProps = Readonly<{
  aiProviders: {
    id: string;
    label: string;
  }[];
  userGroupAiProviders: string[];
  userGroupId: string;
}>;
export default function UserGroupAiProvidersTableBody({ aiProviders, userGroupAiProviders, userGroupId }: UserGroupAiProvidersTableBodyProps) {

  return (
    <tbody data-testid='user-group-ai-providers-table-body'>
      {aiProviders.map((provider) => (
        <UserGroupAiProviderRow
          key={provider.id}
          aiProvider={provider}
          userGroupId={userGroupId}
          isEnabled={userGroupAiProviders.includes(provider.id)}
        />
      ))}
    </tbody>
  );
}
