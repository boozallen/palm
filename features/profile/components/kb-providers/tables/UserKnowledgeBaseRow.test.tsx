import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import UserKnowledgeBaseRow from './UserKnowledgeBaseRow';
import useUpdateUserPreselectedKnowledgeBases from '@/features/profile/api/update-user-preselected-knowledge-bases';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

jest.mock('@/features/profile/api/update-user-preselected-knowledge-bases');
jest.mock('@mantine/notifications');

describe('UserKnowledgeBaseRow', () => {

  const knowledgeBase = {
    id: 'f2b1e1c4-2b9d-4b9d-8d9c-6f6c1d6b8b5b',
    label: 'Example Knowledge Base',
  };

  const mutateAsync = jest.fn();

  let renderUtils: RenderResult;
  let checked = false;

  beforeEach(() => {
    jest.clearAllMocks();

    checked = false;

    (useUpdateUserPreselectedKnowledgeBases as jest.Mock).mockReturnValue({
      mutateAsync: mutateAsync,
      error: null,
    });

    renderUtils = render(
      <table>
        <tbody>
          <UserKnowledgeBaseRow
            knowledgeBase={knowledgeBase}
            checked={checked}
          />
        </tbody>
      </table>
    );
  });

  it('should render the knowledge base label', () => {
    expect(screen.getByText(knowledgeBase.label)).toBeInTheDocument();
  });

  it('should render a checkbox', () => {
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('should not be checked if checked prop is false', () => {
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('should be checked if the checked prop is true', () => {
    renderUtils.rerender(
      <table>
        <tbody>
          <UserKnowledgeBaseRow
            knowledgeBase={knowledgeBase}
            checked={true}
          />
        </tbody>
      </table>
    );

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('should call the mutateAsync when the checkbox is clicked', () => {
    const checkbox = screen.getByRole('checkbox');

    checkbox.click();

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      knowledgeBaseId: knowledgeBase.id,
      preselected: !checked,
    });
  });

  it('should show a notification if the mutation fails', async () => {
    const error = new Error('Failed to update knowledge base selections');
    mutateAsync.mockRejectedValue(error);

    const checkbox = screen.getByRole('checkbox');

    checkbox.click();

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'update-preselected-knowledge-base-failed',
        title: 'Failed to Update',
        message: error.message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });

    });

  });
});
