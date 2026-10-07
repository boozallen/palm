import { render } from '@testing-library/react';
import AgentServicesTableHead from './AgentServicesTableHead';

describe('AgentServicesTableHead', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <table>
        <AgentServicesTableHead />
      </table>
    );
    expect(container).toBeTruthy();
  });

  it('renders all column headers', () => {
    const { getByText } = render(
      <table>
        <AgentServicesTableHead />
      </table>
    );

    expect(getByText('Name')).toBeInTheDocument();
    expect(getByText('Description')).toBeInTheDocument();
    expect(getByText('Endpoint')).toBeInTheDocument();
    expect(getByText('Actions')).toBeInTheDocument();
  });

  it('renders headers in correct order', () => {
    const { container } = render(
      <table>
        <AgentServicesTableHead />
      </table>
    );

    const headers = container.querySelectorAll('th');
    expect(headers[0]).toHaveTextContent('Name');
    expect(headers[1]).toHaveTextContent('Description');
    expect(headers[2]).toHaveTextContent('Endpoint');
    expect(headers[3]).toHaveTextContent('Actions');
  });

  it('renders exactly 4 column headers', () => {
    const { container } = render(
      <table>
        <AgentServicesTableHead />
      </table>
    );

    const headers = container.querySelectorAll('th');
    expect(headers.length).toBe(4);
  });
});
