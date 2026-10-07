import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { useWebPolicyCompliance, useComplianceStatus } from '@/features/ai-agents/api/certa/web-policy-compliance';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';
import Agent from './Agent';

jest.mock('@/features/ai-agents/api/certa/web-policy-compliance');
jest.mock('@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution', () => ({
  useUserGroupAttribution: jest.fn(),
}));
jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

(useWebPolicyCompliance as jest.Mock).mockReturnValue({
  mutate: jest.fn(),
});

(useComplianceStatus as jest.Mock).mockReturnValue({
  refetch: jest.fn().mockResolvedValue({ data: null }),
});

(useUserGroupAttribution as jest.Mock).mockReturnValue({
  gate: jest.fn(async (_modelId, onSubmit) => {
    await onSubmit(undefined);
    return true;
  }),
  pendingDecision: null,
  defaultUserGroupId: undefined,
  setDefaultUserGroupId: jest.fn(),
  onSelect: jest.fn(),
  onDismiss: jest.fn(),
});

jest.mock('./Form', () => {
  return jest.fn(({ onSubmit, isLoading }) => (
    <button
      data-testid='compliance-form-submit'
      data-loading={isLoading}
      onClick={() => onSubmit({ url: 'https://example.com', model: 'model-id', instructions: 'instructions' })}
    >
      Compliance Form
    </button>
  ));
});

jest.mock('./Accordion', () => {
  return jest.fn(() => <p>Policy Accordion</p>);
});

const mockAgentId = '482a16b2-e32f-4c86-8a88-5d7ad351f222';

describe('Agent', () => {
  it('renders form and triggers compliance check', async () => {
    render(<Agent id={mockAgentId} />);
    const formButton = screen.getByTestId('compliance-form-submit');
    expect(formButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(formButton);
    });

    expect(useWebPolicyCompliance().mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com',
        model: 'model-id',
        instructions: 'instructions',
      }),
      expect.any(Object)
    );
  });

  it('renders policy accordion', () => {
    render(<Agent id={mockAgentId} />);
    expect(screen.getByText('Policy Accordion')).toBeInTheDocument();
  });

  it('passes the resolved group attribution choice to the compliance check mutation', async () => {
    (useUserGroupAttribution as jest.Mock).mockReturnValue({
      gate: jest.fn(async (_modelId, onSubmit) => {
        await onSubmit('group-1');
        return true;
      }),
      pendingDecision: null,
      idleGroups: [],
      defaultUserGroupId: undefined,
      setDefaultUserGroupId: jest.fn(),
      onSelect: jest.fn(),
      onDismiss: jest.fn(),
    });

    render(<Agent id={mockAgentId} />);
    const formButton = screen.getByTestId('compliance-form-submit');

    await act(async () => {
      fireEvent.click(formButton);
    });

    expect(useWebPolicyCompliance().mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        userGroupId: 'group-1',
      }),
      expect.any(Object)
    );
  });

  it('clears the processing/loading state instead of hanging when the attribution prompt is dismissed', async () => {
    const mutateMock = useWebPolicyCompliance().mutate as jest.Mock;
    const callCountBeforeDismiss = mutateMock.mock.calls.length;

    (useUserGroupAttribution as jest.Mock).mockReturnValue({
      gate: jest.fn().mockResolvedValue(false),
      pendingDecision: null,
      idleGroups: [],
      defaultUserGroupId: undefined,
      setDefaultUserGroupId: jest.fn(),
      onSelect: jest.fn(),
      onDismiss: jest.fn(),
    });

    render(<Agent id={mockAgentId} />);
    const formButton = screen.getByTestId('compliance-form-submit');

    await act(async () => {
      fireEvent.click(formButton);
    });

    expect(mutateMock.mock.calls.length).toBe(callCountBeforeDismiss);
    expect(formButton).toHaveAttribute('data-loading', 'false');
  });
});
