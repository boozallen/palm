import UserGroupAgentProviderRow from './UserGroupAgentProviderRow';

type UserGroupAgentProvidersTableBodyProps = Readonly<{
  agentProviders: {
    id: string;
    name: string;
  }[];
  userGroupAgentProviders: string[];
  userGroupId: string;
}>;

export default function UserGroupAgentProvidersTableBody({ agentProviders, userGroupAgentProviders, userGroupId }: UserGroupAgentProvidersTableBodyProps) {

  return (
    <tbody data-testid='user-group-agent-providers-table-body'>
      {agentProviders.map((provider) => (
        <UserGroupAgentProviderRow
          key={provider.id}
          agentProvider={provider}
          userGroupId={userGroupId}
          isEnabled={userGroupAgentProviders.includes(provider.id)}
        />
      ))}
    </tbody>
  );
}
