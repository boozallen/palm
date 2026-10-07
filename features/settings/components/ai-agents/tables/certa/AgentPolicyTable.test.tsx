import { render, screen } from '@testing-library/react';
import { v4 } from 'uuid';

import AgentPolicyTable from './AgentPolicyTable';
import { AgentPolicy } from '@/features/shared/types';
import useGetCertaPolicies from '@/features/settings/api/ai-agents/certa/get-certa-policies';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';

jest.mock('@/features/settings/api/ai-agents/certa/get-certa-policies');
jest.mock('./AgentPolicyRow', () => {
  return function MockAgentPolicyRow() {
    return (
      <tr>
        <td>Mocked Row</td>
      </tr>
    );
  };
});

const mockAgentId = 'd9b0cef7-9f66-493d-9385-6620cb5b7f70';
const renderComponent = () => {
  return render(<AgentPolicyTable aiAgentId={mockAgentId} />);
};

let mockPolicies: AgentPolicy[] = [];
const addPolicy = (title: string, content: string, requirements: string) => {
  mockPolicies.push({
    id: v4(),
    aiAgentId: mockAgentId,
    title,
    content,
    requirements,
  });
};
const resetPolicies = () => {
  mockPolicies = [];
};

const mockGetCertaPolicies = (policies = mockPolicies, isPending = false) => {
  (useGetCertaPolicies as jest.Mock).mockReturnValue({
    data: { policies },
    isPending,
  });
};

describe('AgentPolicyTable', () => {
  beforeEach(jest.clearAllMocks);

  describe('Has policies', () => {
    beforeEach(() => {
      addPolicy('Policy 1', 'Content 1', 'Requirements 1');
      addPolicy('Policy 2', 'Content 2', 'Requirements 2');
      addPolicy('Policy 3', 'Content 3', 'Requirements 3');
      mockGetCertaPolicies();
    });

    afterEach(resetPolicies);

    it('renders table headers', () => {
      renderComponent();

      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.getByText('Requirements')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('renders correct number of rows', () => {
      renderComponent();

      expect(screen.getAllByText('Mocked Row')).toHaveLength(
        mockPolicies.length
      );
    });
  });

  describe('No policies', () => {
    it('renders no policies message', () => {
      mockGetCertaPolicies([], false);

      renderComponent();

      expect(
        screen.getByText('No policies have been configured yet.')
      ).toBeInTheDocument();
    });
  });

  describe('Policies loading', () => {
    it('renders loading component', () => {
      mockGetCertaPolicies([], true);

      renderComponent();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  it('does not display pagination if agentPolicies.length < ITEMS_PER_PAGE', () => {
    mockGetCertaPolicies([
      {
        id: 'test-id-1',
        aiAgentId: mockAgentId,
        title: 'Test Policy 1',
        content: 'Test Content 1',
        requirements: 'Test Requirements 1',
      },
    ]);

    renderComponent();

    expect(screen.queryByTestId('policies-pagination')).not.toBeInTheDocument();
  });

  it('displays pagination if the number of policies is greater than ITEMS_PER_PAGE', () => {
    const manyPolicies = Array.from(
      { length: ITEMS_PER_PAGE + 1 },
      (_, index) => ({
        id: `test-id-${index}`,
        aiAgentId: mockAgentId,
        title: `Test Policy ${index}`,
        content: `Test Content ${index}`,
        requirements: `Test Requirements ${index}`,
      })
    );

    mockGetCertaPolicies(manyPolicies, false);

    renderComponent();

    expect(screen.getByTestId('policies-pagination')).toBeInTheDocument();
  });
});
