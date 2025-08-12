import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useForm } from '@mantine/form';

import Form from './Form';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import userEvent from '@testing-library/user-event';
import { AgentPolicy } from '@/features/shared/types';
import useGetAvailablePolicies from '@/features/ai-agents/api/certa/get-available-policies';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/form');
jest.mock('@/features/shared/api/get-available-models');
jest.mock('@/features/ai-agents/api/certa/get-available-policies');

describe('Form', () => {
  const mockOnSubmit = jest.fn();
  const setSelectedPolicies = jest.fn();
  const handleDownload = jest.fn();

  const availableModels = [
    {
      id: '92be6efd-7334-408f-b943-baf286a7fe27',
      name: 'GPT-3',
      providerLabel: 'OpenAI',
    },
  ];

  const mockAgentId = 'f1c45d1d-2448-476a-9965-e315b5accaf2';

  const mockPolicies: AgentPolicy[] = [
    {
      id: '05e9c762-4ec5-48ce-a593-0b3d62cb9106',
      aiAgentId: mockAgentId,
      title: 'Policy 1',
      content: 'Content 1',
      requirements: 'Requirements 1',
    },
    {
      id: '57b25e7c-f8e2-493e-964f-0e3e95256c79',
      aiAgentId: mockAgentId,
      title: 'Policy 2',
      content: 'Content 2',
      requirements: 'Requirements 2',
    },
  ];

  const mockSelectedPolicies: AgentPolicy[] = [];

  const mockFormValues = {
    url: 'https://www.some-test-website.com',
    policy: [mockPolicies[0].id],
    model: '92be6efd-7334-408f-b943-baf286a7fe27',
    instructions: '',
  };

  const mockUseForm = (overrides = {}) => {
    const defaultMock = {
      values: mockFormValues,
      getInputProps: jest.fn(),
      onSubmit: jest.fn(cb => () => cb(mockFormValues)),
      isValid: () => true,
      setFieldValue: jest.fn(),
    };

    return jest.fn().mockReturnValue({ ...defaultMock, ...overrides });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: { availableModels },
    });

    (useGetAvailablePolicies as jest.Mock).mockReturnValue({
      data: {
        policies: mockPolicies,
      },
    });

    (useForm as jest.Mock).mockImplementation(mockUseForm());
  });

  it('renders correct form fields', () => {
    render(
      <Form
        agentId={mockAgentId}
        selectedPolicies={mockSelectedPolicies}
        setSelectedPolicies={setSelectedPolicies}
        handleDownload={handleDownload}
        isLoading={false}
        onSubmit={mockOnSubmit}
      />
    );

    const url = screen.getByLabelText('Subject Webpage');
    const policy = screen.getByLabelText('Policy');
    const model = screen.getByLabelText('Model');

    expect(url).toBeInTheDocument();
    expect(policy).toBeInTheDocument();
    expect(model).toBeInTheDocument();
  });

  it('renders additional instructions in popover', () => {
    render(
      <Form
        agentId={mockAgentId}
        selectedPolicies={mockSelectedPolicies}
        setSelectedPolicies={setSelectedPolicies}
        handleDownload={handleDownload}
        isLoading={false}
        onSubmit={mockOnSubmit}
      />
    );

    const popover = screen.getByTestId('additional-instructions-button');
    act(() => {
      fireEvent.click(popover);
    });

    const instructions = screen.getByLabelText('Additional Instructions');
    expect(instructions).toBeInTheDocument();

  });

  it('updates state whenever new policy is selected', async () => {
    render(
      <Form
        agentId={mockAgentId}
        selectedPolicies={mockSelectedPolicies}
        setSelectedPolicies={setSelectedPolicies}
        handleDownload={handleDownload}
        isLoading={false}
        onSubmit={mockOnSubmit}
      />
    );

    const policySelect = screen.getByLabelText('Policy');

    await userEvent.click(policySelect);
    await userEvent.click(screen.getByText(mockPolicies[0].title));

    expect(setSelectedPolicies).toHaveBeenCalledWith([
      {
        aiAgentId: mockAgentId,
        id: mockPolicies[0].id,
        title: mockPolicies[0].title,
        content: mockPolicies[0].content,
        requirements: mockPolicies[0].requirements,
      },
    ]);
  });

  it('submits form once form is valid', async () => {
    render(
      <Form
        agentId={mockAgentId}
        selectedPolicies={mockSelectedPolicies}
        setSelectedPolicies={setSelectedPolicies}
        handleDownload={handleDownload}
        isLoading={false}
        onSubmit={mockOnSubmit}
      />
    );

    const form = screen.getByTestId('certa-form');
    fireEvent.submit(form);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      url: 'https://www.some-test-website.com',
      policy: [mockPolicies[0].id],
      model: availableModels[0].id,
      instructions: '',
    });
  });
});
