import { render } from '@testing-library/react';
import AiAgents from './AiAgents';

jest.mock('./tables/AiAgentsTable', () => {
  return function MockedAiAgentsTable() {
    return <div data-testid='ai-agents-table-mock'>Mocked AI Agents Table</div>;
  };
});

describe('AI Agents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render "AI Agents" title', () => {
    const { queryByText } = render(<AiAgents />);
    expect(queryByText('AI Agents')).toBeInTheDocument();
  });

  it('should render AiAgentsTable', () => {
    const { queryByTestId } = render(<AiAgents />);
    expect(queryByTestId('ai-agents-table-mock')).toBeInTheDocument();
  });
});
