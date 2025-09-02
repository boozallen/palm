import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import PolicyContent from './PolicyContent';
import { Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('PolicyContent', () => {
  const mockPolicy: Policy = {
    id: '098e6f06-3231-4bff-a210-1d2404aba341',
    title: 'Unit Testing',
    content: 'This is a test suite',
    requirements: '- Must have requirement list',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title and policy requirements', () => {
    render(<PolicyContent policy={mockPolicy} />);

    let textContent: string = '';
    screen.getAllByText((_, element) => {
      if (!element) {
        return false;
      }
      textContent += element.textContent ?? '';
      return true;
    });

    expect(textContent.includes('Policy Requirements')).toBe(true);
    expect(textContent.includes(mockPolicy.requirements)).toBe(true);
  });

  it('renders policy contents in popup modal', async () => {
    render(<PolicyContent policy={mockPolicy} />);

    const linkElement = screen.getByText('here');
    fireEvent.click(linkElement);

    await waitFor(() => {
      expect(screen.getByText('Policy Content')).toBeInTheDocument();
      expect(screen.getByText(mockPolicy.content)).toBeInTheDocument();
    });

  });
});
