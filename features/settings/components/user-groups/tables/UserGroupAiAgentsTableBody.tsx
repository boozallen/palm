import UserGroupAiAgentRow from './UserGroupAiAgentRow';

type UserGroupAiAgentsTableBodyProps = Readonly<{
  aiAgents: {
    id: string;
    name: string;
  }[];
  userGroupAiAgents: string[];
  userGroupId: string;
}>;
export default function UserGroupAiAgentsTableBody({ aiAgents, userGroupAiAgents, userGroupId }: UserGroupAiAgentsTableBodyProps) {

  return (
    <tbody data-testid='user-group-ai-agents-table-body'>
      {aiAgents.map((agent) => (
        <UserGroupAiAgentRow
          key={agent.id}
          aiAgent={agent}
          userGroupId={userGroupId}
          isEnabled={userGroupAiAgents.includes(agent.id)}
        />
      ))}
    </tbody>
  );
}
