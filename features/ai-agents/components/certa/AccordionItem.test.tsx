import { render, screen } from '@testing-library/react';
import { Accordion } from '@mantine/core';

import AccordionItem from './AccordionItem';
import Result from './Result';
import PolicyContent from './PolicyContent';
import { Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';

let capturedPolicyContentProps = {};
let capturedResultProps = {};

jest.mock('./Result', () => {
  const mockResult = jest.fn((props) => {
    capturedResultProps = { ...props };
    return <div>Policy Compliance Result</div>;
  });
  return mockResult;
});

jest.mock('./PolicyContent', () => {
  const mockPolicyContent = jest.fn((props) => {
    capturedPolicyContentProps = { ...props };
    return <div>Policy Content</div>;
  });
  return mockPolicyContent;
});

jest.mock('./Badge', () => {
  return jest.fn(() => <div>Compliance Badge</div>);
});

describe('AccordionItem', () => {
  const mockPolicy: Policy = {
    id: '098e6f06-3231-4bff-a210-1d2404aba341',
    title: 'Mock Policy',
    content: 'Mock Content',
    requirements: 'Mock Requirements',
  };

  const isLoading = false;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedPolicyContentProps = {};
    capturedResultProps = {};
  });

  it('renders the policy title', () => {
    render(
      <Accordion>
        <AccordionItem
          policy={mockPolicy}
          isLoading={isLoading}
        />,
      </Accordion>
    );

    const policyTitle = screen.getByText(mockPolicy.title);

    expect(policyTitle).toBeInTheDocument();
  });

  it('renders policy compliance badge', () => {
    render(
      <Accordion>
        <AccordionItem
          policy={mockPolicy}
          isLoading={isLoading}
        />,
      </Accordion>
    );

    const badge = screen.getByText('Compliance Badge');

    expect(badge).toBeInTheDocument();
  });

  it('passes policy into policy content', () => {
    render(
      <Accordion>
        <AccordionItem
          policy={mockPolicy}
          isLoading={isLoading}
        />,
      </Accordion>
    );

    expect(PolicyContent).toHaveBeenCalled();

    expect(capturedPolicyContentProps).toEqual(
      expect.objectContaining({
        policy: mockPolicy,
      })
    );
  });

  it('passes isLoading into Result', () => {
    render(
      <Accordion>
        <AccordionItem
          policy={mockPolicy}
          isLoading={isLoading}
        />,
      </Accordion>
    );

    expect(Result).toHaveBeenCalled();

    expect(capturedResultProps).toEqual(
      expect.objectContaining({
        isLoading: isLoading,
      })
    );
  });
});
