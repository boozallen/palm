import { render, screen } from '@testing-library/react';

import AiProvidersUsageTable from './AiProvidersUsageTable';
import { ProviderCosts } from '@/features/settings/types/analytics';

jest.mock('./ProviderUsageRow', () => {
  return function MockedProviderUsageRow() {
    return <tr><td>ProviderUsageRow</td></tr>;
  };
});

jest.mock('./ModelUsageRow', () => {
  return function MockedModelUsageRow() {
    return <tr><td>ModelUsageRow</td></tr>;
  };
});

const providerCosts: ProviderCosts[] = [
  {
    id: 'c7a45be1-672b-459d-9dc4-5db589c5c217',
    label: 'Provider 1',
    cost: 200,
    models: [
      {
        id: 'd3d9a820-d925-43a6-a278-c0110fd32169',
        label: 'Model 1',
        cost: 50,
      },
      {
        id: '303569d5-e0bc-422c-8e99-5f0cc4b1a663',
        label: 'Model 2',
        cost: 50,
      },
      {
        id: 'c0e54354-0970-4a64-8208-a745e108965a',
        label: 'Model 3',
        cost: 50,
      },
      {
        id: '49b1c80b-2e36-4daa-979b-5fb17290a5d9',
        label: 'Model 4',
        cost: 50,
      },
    ],
  },
];

describe('AiProvidersUsageTable', () => {
  it('should render table header', () => {
    render(<AiProvidersUsageTable providerCosts={providerCosts} />);

    expect(screen.queryByText('Provider')).toBeInTheDocument();
    expect(screen.queryByText('Model Name')).toBeInTheDocument();
    expect(screen.queryByText('Cost')).toBeInTheDocument();
  });

  it('should render provider and model rows', () => {
    render(<AiProvidersUsageTable providerCosts={providerCosts} />);

    const providerRows = screen.getAllByText('ProviderUsageRow');
    const modelRows = screen.getAllByText('ModelUsageRow');

    expect(providerRows).toHaveLength(1);
    expect(modelRows).toHaveLength(4);
  });
});
