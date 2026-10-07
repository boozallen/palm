import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelRow from './ModelRow';
import useDeleteAiProviderModel from '@/features/settings/api/ai-providers/delete-ai-provider-model';

jest.mock('@/features/settings/api/ai-providers/delete-ai-provider-model');

function TableWrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <table>
      <thead></thead>
      <tbody>{children}</tbody>
    </table>
  );
}

jest.mock('@/features/settings/utils/useTestModel', () => {
  return jest.fn(() => ({
    testModel: jest.fn(),
    error: null,
  }));
});

describe('ModelRow', () => {
  const mockModel = {
    id: '3fab1155-f24f-4e83-a3ba-335627395d26',
    aiProviderId: 'c2f5e94e-9048-450f-adf8-6e2de630a799',
    name: 'Model Name',
    externalId: 'test-model',
    costPerMillionInputTokens: 30,
    costPerMillionOutputTokens: 45,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useDeleteAiProviderModel as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
      error: null,
    });
  });

  const renderRow = (props: { embeddingsOnly?: boolean } = {}) =>
    render(
      <TableWrapper>
        <ModelRow
          {...mockModel}
          {...props}
          modelBeingTested={'model-to-test'}
          setModelBeingTested={() => {}}
        />
      </TableWrapper>,
    );

  it('renders the model data', () => {
    renderRow();

    expect(screen.getByText(mockModel.name)).toBeInTheDocument();
    expect(screen.getByText(mockModel.externalId)).toBeInTheDocument();
    expect(screen.getByText(`$${mockModel.costPerMillionInputTokens.toFixed(2)}`)).toBeInTheDocument();
    expect(screen.getByText(`$${mockModel.costPerMillionOutputTokens.toFixed(2)}`)).toBeInTheDocument();
  });

  it('renders editModelForm when pencil icon is clicked', () => {
    renderRow();

    const editButton = screen.getByTestId(`${mockModel.id}-edit`);

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('External ID')).not.toBeInTheDocument();

    userEvent.click(editButton);

    waitFor(() => {
      expect(screen.queryByLabelText('Name')).toBeInTheDocument();
      expect(screen.queryByLabelText('External ID')).toBeInTheDocument();
    });
  });

  it('renders delete model modal when trash can icon is clicked', async () => {
    renderRow();

    const deleteButton = screen.getByTestId(`${mockModel.id}-delete`);

    expect(screen.queryByText('Delete Model')).not.toBeInTheDocument();

    await userEvent.click(deleteButton);

    waitFor(() => {
      expect(screen.queryByText('Delete Model')).toBeInTheDocument();
    });
  });

  // Every model is hand-configured now, so the embeddings-only designation is
  // just a flag on an ordinary row — it never restricts the row's own actions.
  it('offers a delete action for an embeddings-only model', () => {
    renderRow({ embeddingsOnly: true });

    expect(screen.getByTestId(`${mockModel.id}-delete`)).toBeInTheDocument();
    expect(screen.getByTestId(`${mockModel.id}-edit`)).toBeInTheDocument();
  });

  // The designation is chosen when the model is added, so the row reports it.
  it('badges an embeddings-only model', () => {
    renderRow({ embeddingsOnly: true });

    expect(screen.getByTestId(`${mockModel.id}-embeddings-badge`)).toBeInTheDocument();
  });

  it('does not badge an ordinary model', () => {
    renderRow();

    expect(screen.queryByTestId(`${mockModel.id}-embeddings-badge`)).not.toBeInTheDocument();
  });

  // A chat completion is the only test we can send, and an embedding model cannot
  // serve one — offering the button would blame a correct configuration.
  it('hides the test button for an embeddings-only model', () => {
    renderRow({ embeddingsOnly: true });

    expect(screen.queryByTestId(`${mockModel.id}-test`)).not.toBeInTheDocument();
  });

  it('shows the test button for an ordinary model', () => {
    renderRow();

    expect(screen.getByTestId(`${mockModel.id}-test`)).toBeInTheDocument();
  });
});
