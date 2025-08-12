import { ReactNode } from 'react';
import { render } from '@testing-library/react';

import { Prompt } from '@/features/shared/types';
import PromptDetailsContainer from './PromptDetailsContainer';

let promptDetailsProviderPrompt: Prompt | null = null;
jest.mock('@/features/library/providers/PromptDetailsProvider', () => ({
  PromptDetailsProvider: ({ prompt, children }: { prompt: Prompt, children: ReactNode }) => {
    promptDetailsProviderPrompt = prompt;
    return <>{ children }</>;
  },
}));

jest.mock('./PromptDetailsHeader', () => {
  return jest.fn(() => <p>PromptDetailsHeader</p>);
});

jest.mock('./RunPromptForm', () => {
  return jest.fn(() => <p>RunPromptForm</p>);
});

describe('PromptDetailsContainer', () => {
  const mockPrompt: Prompt = {
    id: 'mock-id',
    title: 'Mock Title',
    description: 'Mock Description',
    summary: 'Mock Summary',
    instructions: 'Mock Instructions',
    example: 'Mock Example',
    tags: ['tag1', 'tag2'],
    config: {
      model: 'mock-model',
      repetitiveness: 0.2,
      randomness: 0.5,
    },
    creatorId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    promptDetailsProviderPrompt = null;
  });

  it('calls PromptDetailsProvider with prompt', () => {
    render(<PromptDetailsContainer prompt={mockPrompt} />);
    expect(promptDetailsProviderPrompt).toEqual(mockPrompt);
  });

  it('renders header', () => {
    const { getByText } = render(<PromptDetailsContainer prompt={mockPrompt} />);
    expect(getByText('PromptDetailsHeader')).toBeInTheDocument();
  });

  it('renders form', () => {
    const { getByText } = render(<PromptDetailsContainer prompt={mockPrompt} />);
    expect(getByText('RunPromptForm')).toBeInTheDocument();
  });
});
