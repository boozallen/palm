import AgentProviderRow from './AgentProviderRow';

type AgentProvider = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
};

type AgentProvidersTableBodyProps = {
  agentProviders: AgentProvider[];
};

export default function AgentProvidersTableBody({
  agentProviders,
}: Readonly<AgentProvidersTableBodyProps>) {
  return (
    <tbody>
      {agentProviders.map((provider) => (
        <AgentProviderRow key={provider.id} provider={provider} />
      ))}
    </tbody>
  );
}
