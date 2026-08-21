import { useDisclosure } from '@mantine/hooks';
import { render } from '@testing-library/react';

import AiAgents from './AiAgents';

jest.mock('@mantine/hooks');

jest.mock('./tables/AiAgentsTable', () => {
  return function MockedAiAgentsTable() {
    return <div data-testid='ai-agents-table-mock'>Mocked AI Agents Table</div>;
  };
});

jest.mock('./modals/AddAgentModal', () => {
  return jest.fn(() => <div>Add Agent Modal</div>);
});

describe('AI Agents', () => {
  let opened = false;
  const open = jest.fn(() => opened = true);
  const close = jest.fn(() => opened = false);

  (useDisclosure as jest.Mock).mockReturnValue([
    opened,
    { open, close },
  ]);

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

  it('renders action icon', () => {
    const { getByLabelText } = render(<AiAgents />);
    const actionIcon = getByLabelText('Add AI agent');
    expect(actionIcon).toBeInTheDocument();
  });

  it('calls open function when action icon is clicked', () => {
    const { getByLabelText } = render(<AiAgents />);
    const actionIcon = getByLabelText('Add AI agent');
    actionIcon.click();
    expect(open).toHaveBeenCalled();
    expect(opened).toBe(true);
  });

  it('renders AddAgentModal', () => {
    const { getByText } = render(<AiAgents />);
    expect(getByText('Add Agent Modal')).toBeInTheDocument();
  });
});
