import { render, screen } from '@testing-library/react';

import Agent from './Agent';

jest.mock('@/features/ai-agents/api/rcast/upload-rate-card', () => ({
  __esModule: true,
  default: () => ({
    mutateAsync: jest.fn(),
  }),
}));

jest.mock('@/features/ai-agents/api/rcast/get-rcast-status', () => ({
  useRcastStatus: () => ({
    data: null,
  }),
}));

jest.mock('@/features/ai-agents/api/rcast/get-rate-cards', () => ({
  useGetRateCards: () => ({
    data: [],
    isPending: false,
  }),
}));

jest.mock('@/features/ai-agents/api/rcast/get-rate-card-categories', () => ({
  useGetRateCardCategories: () => ({
    data: [],
    isPending: false,
  }),
}));

jest.mock('@/features/ai-agents/api/rcast/fetch-salary-com-data', () => ({
  __esModule: true,
  default: () => ({
    mutateAsync: jest.fn(),
  }),
}));

jest.mock('@/features/ai-agents/api/rcast/export-rate-card', () => ({
  __esModule: true,
  default: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('@/features/shared/api/get-available-models', () => ({
  __esModule: true,
  default: () => ({
    data: {
      availableModels: [
        { id: 'model-1', name: 'GPT-4', providerLabel: 'OpenAI' },
        { id: 'model-2', name: 'Claude', providerLabel: 'Anthropic' },
      ],
    },
  }),
}));

jest.mock('@/libs', () => ({
  trpc: {
    useUtils: () => ({
      aiAgents: {
        getRateCards: {
          invalidate: jest.fn(),
        },
      },
    }),
  },
}));

describe('RCAST-TWO Agent', () => {
  const mockAgentId = 'd59a6bfa-fe00-496e-9854-30c49f5d7588';

  it('renders the title and description', () => {
    render(<Agent id={mockAgentId} />);

    expect(screen.getByText('Rate Card Analysis')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Manage rate cards with automated SOC code mapping and BLS/DOL wage data analysis.'
      )
    ).toBeInTheDocument();
  });
});
