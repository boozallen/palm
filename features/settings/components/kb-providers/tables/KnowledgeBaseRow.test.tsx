import { render, screen, fireEvent } from '@testing-library/react';

import KnowledgeBaseRow from './KnowledgeBaseRow';
import useDeleteKnowledgeBase from '@/features/settings/api/delete-knowledge-base';

jest.mock('@/features/settings/api/delete-knowledge-base');

(useDeleteKnowledgeBase as jest.Mock).mockReturnValue({
  mutate: jest.fn(),
  isPending: false,
  error: null,
});

jest.mock(
  '@/features/settings/components/kb-providers/forms/EditKnowledgeBaseForm',
  () => {
    return function MockEditKnowledgeBaseForm() {
      return <div data-testid='mock-edit-form'>Mocked Edit Form</div>;
    };
  }
);

describe('KnowledgeBaseRow', () => {
  const knowledgeBase = {
    id: 'd51af818-0a29-40f6-b2bc-2b3c915d31a2',
    label: 'Onboarding Information',
    externalId: 'onboarding-info',
    kbProviderId: '60c410be-11b0-4b78-ad85-dceeeb0701cd',
    updatedAt: new Date('2021-06-15T14:00:00Z'),
  };

  beforeEach(() => {
    render(
      <table>
        <tbody>
          <KnowledgeBaseRow knowledgeBase={knowledgeBase} />
        </tbody>
      </table>
    );
  });

  it('renders text content', () => {
    const label = screen.getByText(knowledgeBase.label);
    const externalId = screen.getByText(knowledgeBase.externalId);

    expect(label).toBeInTheDocument();
    expect(externalId).toBeInTheDocument();
  });

  it('renders action icons', () => {
    const pencilIcon = screen.getByTestId(`${knowledgeBase.id}-edit`);
    const trashIcon = screen.getByTestId(`${knowledgeBase.id}-delete`);

    expect(pencilIcon).toBeInTheDocument();
    expect(trashIcon).toBeInTheDocument();
  });

  it('replaces row with EditKnowledgeBaseForm when pencil icon is clicked', () => {
    const pencilIcon = screen.getByTestId(`${knowledgeBase.id}-edit`);

    expect(screen.queryByTestId('mock-edit-form')).not.toBeInTheDocument();

    fireEvent.click(pencilIcon);

    expect(screen.getByTestId('mock-edit-form')).toBeInTheDocument();
    expect(screen.queryByText(knowledgeBase.label)).not.toBeInTheDocument();
    expect(
      screen.queryByText(knowledgeBase.externalId)
    ).not.toBeInTheDocument();
  });
});
