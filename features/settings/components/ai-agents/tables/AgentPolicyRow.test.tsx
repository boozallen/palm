import { fireEvent, render, screen } from '@testing-library/react';
import { v4 } from 'uuid';

import AgentPolicyRow from './AgentPolicyRow';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock(
  '@/features/settings/components/ai-agents/modals/DeletePolicyModal',
  () => {
    return jest.fn((props) => (
      <tr
        data-testid='delete-policy-modal'
        data-opened={props.modalOpened}
        data-policy-id={props.policyId}
      />
    ));
  }
);

jest.mock(
  '@/features/settings/components/ai-agents/modals/EditPolicyModal',
  () => {
    return jest.fn((props) => (
      <tr
        data-testid='edit-policy-modal'
        data-opened={props.isOpened}
        data-policy-id={props.policyId}
      />
    ));
  }
);

const policy = {
  id: v4(),
  aiAgentId: v4(),
  title: 'Test Policy',
  content: 'Test Content',
  requirements: 'Test Requirements',
};

beforeEach(() => {
  jest.clearAllMocks();
});

const renderComponent = () => {
  return render(
    <table>
      <tbody>
        <AgentPolicyRow policy={policy} />
      </tbody>
    </table>
  );
};

describe('AgentPolicyRow', () => {
  it('renders policy title', () => {
    const { getByText } = renderComponent();

    expect(getByText(policy.title)).toBeInTheDocument();
  });

  it('renders policy content', () => {
    const { getByText } = renderComponent();

    expect(getByText(policy.content)).toBeInTheDocument();
  });

  it('renders policy requirements', () => {
    const { getByText } = renderComponent();

    expect(getByText(policy.requirements)).toBeInTheDocument();
  });

  it('renders action icons', () => {
    const { getByLabelText } = renderComponent();

    expect(getByLabelText(`Edit ${policy.title} Policy`)).toBeInTheDocument();
    expect(getByLabelText(`Delete ${policy.title} Policy`)).toBeInTheDocument();
  });

  it('opens delete modal when trash icon is clicked', () => {
    renderComponent();

    const deleteButton = screen.getByLabelText(`Delete ${policy.title} Policy`);

    const modalBeforeClick = screen.getByTestId('delete-policy-modal');
    expect(modalBeforeClick).toBeInTheDocument();
    expect(modalBeforeClick.getAttribute('data-opened')).toBe('false');

    fireEvent.click(deleteButton);

    const modalAfterClick = screen.getByTestId('delete-policy-modal');
    expect(modalAfterClick.getAttribute('data-opened')).toBe('true');
    expect(modalAfterClick.getAttribute('data-policy-id')).toBe(policy.id);
  });

  it('opens edit modal when pencil icon is clicked', () => {
    renderComponent();

    const editButton = screen.getByLabelText(`Edit ${policy.title} Policy`);

    const modalBeforeClick = screen.getByTestId('edit-policy-modal');
    expect(modalBeforeClick).toBeInTheDocument();
    expect(modalBeforeClick.getAttribute('data-opened')).toBe('false');

    fireEvent.click(editButton);

    const modalAfterClick = screen.getByTestId('edit-policy-modal');
    expect(modalAfterClick.getAttribute('data-opened')).toBe('true');
    expect(modalAfterClick.getAttribute('data-policy-id')).toBe(policy.id);
  });
});
