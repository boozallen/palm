import UserGroupGitHubProviderRow from './UserGroupGitHubProviderRow';

type UserGroupGitHubProvidersTableBodyProps = Readonly<{
  githubProviders: {
    id: string;
    label: string;
  }[];
  userGroupGitHubProviders: string[];
  userGroupId: string;
}>;

export default function UserGroupGitHubProvidersTableBody({ githubProviders, userGroupGitHubProviders, userGroupId }: UserGroupGitHubProvidersTableBodyProps) {

  return (
    <tbody data-testid='user-group-github-providers-table-body'>
      {githubProviders.map((provider) => (
        <UserGroupGitHubProviderRow
          key={provider.id}
          githubProvider={provider}
          userGroupId={userGroupId}
          isEnabled={userGroupGitHubProviders.includes(provider.id)}
        />
      ))}
    </tbody>
  );
}
