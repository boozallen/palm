import { render, screen } from '@testing-library/react';

import Accordion from './Accordion';
import { PolicyResults, Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';

jest.mock('./AccordionItem', () => {
  return jest.fn(({ policy }) => <div>Accordion Item: {policy.title}</div>);
});

describe('Accordion', () => {
  const results: PolicyResults = {};
  const loadingPolicies = {
    'Policy 1': false,
    'Policy 2': false,
    'Policy 3': false,
    'Policy 4': false,
  };

  const selectedPolicies: Policy[] = [
    {
      id: '87ffbf79-66c8-4c65-86c8-5d3495014ee0',
      title: 'Policy 1',
      content: 'Policy 1 content',
      requirements: 'Policy 1 requirements',
    },
    {
      id: '7af88a9e-d8fc-425f-8212-1d63f80db507',
      title: 'Policy 2',
      content: 'Policy 2 content',
      requirements: 'Policy 2 requirements',
    },
    {
      id: 'abe95c9f-4d7b-4bf3-a14e-fc0fc9293b5e',
      title: 'Policy 3',
      content: 'Policy 3 content',
      requirements: 'Policy 3 requirements',
    },
    {
      id: 'e29eb4c9-00ca-41ab-b08a-d9c4c1482ef3',
      title: 'Policy 4',
      content: 'Policy 4 content',
      requirements: 'Policy 4 requirements',
    },
  ];

  it('renders correct number of items', () => {
    render(
      <Accordion
        selectedPolicies={selectedPolicies}
        results={results}
        loadingPolicies={loadingPolicies}
      />
    );

    const accordionItems = screen.getAllByText(/Accordion Item:/);

    expect(accordionItems.length).toBe(selectedPolicies.length);
  });

  it('does not render anything if no policies are selected', () => {
    const { container } = render(
      <Accordion selectedPolicies={[]} results={results} loadingPolicies={{}} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
