import { render, screen } from '@testing-library/react';

import AiProviderUsageResults from './AiProviderUsageResults';
import { InitiatedBy, TimeRange, UsageRecords } from '@/features/settings/types/analytics';

jest.mock('@/features/shared/api/get-feature-flag');

jest.mock('./tables/AiProvidersUsageTable', () => {
  return function AiProvidersUsageTable() {
    return <div>AiProvidersUsageTable</div>;
  };
});

describe('AiProviderUsageResults', () => {
  let resultsMock: UsageRecords;

  beforeEach(() => {

    resultsMock = {
      initiatedBy: InitiatedBy.Any,
      aiProvider: 'OpenAI',
      model: undefined,
      timeRange: TimeRange.Month,
      totalCost: 123.45,
      providers: [{
        id: '1c8fff18-15a3-44e9-a902-a5eb6639595a',
        label: 'Provider 1',
        cost: 123.45,
        models: [
          {
            id: 'a0570eb2-9450-49a4-ae2f-034be400860d',
            label: 'Model 1',
            cost: 50.25,
          },
          {
            id: '6f7c8b3e-4e6a-4e1f-8d5c-2b6c1b4f6f5e',
            label: 'Model 2',
            cost: 73.20,
          },
        ],
      }],
    };
  });

  it('renders filters used', () => {
    render(<AiProviderUsageResults results={resultsMock} />);

    expect(screen.getByText(
      `Initiated By: ${resultsMock.initiatedBy}, Provider: ${resultsMock.aiProvider}, Model: All models, Time Range: ${resultsMock.timeRange}`
    )).toBeInTheDocument();
  });

  it('renders all providers in header provider is all', () => {
    resultsMock.aiProvider = undefined;

    render(<AiProviderUsageResults results={resultsMock} />);

    expect(screen.getByText(
      /Provider: All providers/
    )).toBeInTheDocument();
  });

  it('renders no results found if there are no records', () => {
    resultsMock.providers = [];

    render(<AiProviderUsageResults results={resultsMock} />);

    expect(screen.queryByText(
      /No Results Found/
    )).toBeInTheDocument();
    expect(screen.queryByText('AiProvidersUsageTable')).not.toBeInTheDocument();
  });

  it('renders total cost text and value', () => {
    render(<AiProviderUsageResults results={resultsMock} />);

    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('$123.45')).toBeInTheDocument();
  });

  it('correctly formats total costs less than $0.01', () => {
    const lowCostResultsMock = resultsMock;
    lowCostResultsMock.totalCost = 0.008;
    render(<AiProviderUsageResults results={lowCostResultsMock} />);

    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('<$0.01')).toBeInTheDocument();
  });

  it('renders nothing if results is undefined', () => {
    const { container } = render(<AiProviderUsageResults results={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders AI providers title and table component', () => {
    render(<AiProviderUsageResults results={resultsMock} />);

    expect(screen.getByText('AI Providers')).toBeInTheDocument();
    expect(screen.getByText('AiProvidersUsageTable')).toBeInTheDocument();
  });
});
