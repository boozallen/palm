import { render } from '@testing-library/react';
import AgentServicesTableBody from './AgentServicesTableBody';

jest.mock('./AgentServiceRow', () => {
  return function MockedAgentServiceRow({ service }: { service: { id: string; name: string } }) {
    return (
      <tr data-testid={`agent-service-row-${service.id}`}>
        <td>{service.name}</td>
      </tr>
    );
  };
});

describe('AgentServicesTableBody', () => {
  const mockServices = [
    {
      id: 'service-1',
      name: 'Service 1',
      description: 'Description 1',
      endpoint: 'https://service1.com',
    },
    {
      id: 'service-2',
      name: 'Service 2',
      description: 'Description 2',
      endpoint: 'https://service2.com',
    },
    {
      id: 'service-3',
      name: 'Service 3',
      description: 'Description 3',
      endpoint: 'https://service3.com',
    },
  ];

  it('renders all service rows', () => {
    const { getByTestId } = render(
      <table>
        <AgentServicesTableBody services={mockServices} />
      </table>
    );

    expect(getByTestId('agent-service-row-service-1')).toBeInTheDocument();
    expect(getByTestId('agent-service-row-service-2')).toBeInTheDocument();
    expect(getByTestId('agent-service-row-service-3')).toBeInTheDocument();
  });

  it('renders empty tbody when no services', () => {
    const { container } = render(
      <table>
        <AgentServicesTableBody services={[]} />
      </table>
    );

    const tbody = container.querySelector('tbody');
    expect(tbody?.children.length).toBe(0);
  });

  it('renders correct number of rows', () => {
    const { container } = render(
      <table>
        <AgentServicesTableBody services={mockServices} />
      </table>
    );

    const rows = container.querySelectorAll('tr');
    expect(rows.length).toBe(3);
  });
});
