import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { useWebPolicyCompliance, useComplianceStatus } from '@/features/ai-agents/api/certa/web-policy-compliance';
import Agent from './Agent';

jest.mock('@/features/ai-agents/api/certa/web-policy-compliance');
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

jest.mock('./Form', () => {
  return jest.fn(({ onSubmit }) => (
    <button onClick={() => onSubmit({ url: 'https://example.com', model: 'model-id', instructions: 'instructions' })}>
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
    const formButton = screen.getByText('Compliance Form');
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
});
