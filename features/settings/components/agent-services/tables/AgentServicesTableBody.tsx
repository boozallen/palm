import AgentServiceRow from './AgentServiceRow';

type AgentService = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
};

type AgentServicesTableBodyProps = {
  services: AgentService[];
};

export default function AgentServicesTableBody({
  services,
}: Readonly<AgentServicesTableBodyProps>) {
  return (
    <tbody>
      {services.map((service) => (
        <AgentServiceRow key={service.id} service={service} />
      ))}
    </tbody>
  );
}
