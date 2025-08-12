import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelRow from './ModelRow';
import useDeleteAiProviderModel from '@/features/settings/api/delete-ai-provider-model';

jest.mock('@/features/settings/api/delete-ai-provider-model');

function TableWrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <table>
      <thead></thead>
      <tbody>{children}</tbody>
    </table>
  );
}

(useDeleteAiProviderModel as jest.Mock).mockReturnValue({
  mutateAsync: jest.fn(),
  isPending: false,
  error: null,
  setNewModelBeingTested: () => {},
});

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

  it('renders the model data', () => {
    render(
      <TableWrapper>
        <ModelRow
          {...mockModel}
          modelBeingTested={'model-to-test'}
          setModelBeingTested={() => {}}
        />
      </TableWrapper>,
    );

    expect(screen.getByText(mockModel.name)).toBeInTheDocument();
    expect(screen.getByText(mockModel.externalId)).toBeInTheDocument();
    expect(screen.getByText(`$${mockModel.costPerMillionInputTokens.toFixed(2)}`)).toBeInTheDocument();
    expect(screen.getByText(`$${mockModel.costPerMillionOutputTokens.toFixed(2)}`)).toBeInTheDocument();
  });

  it('renders editModelForm when pencil icon is clicked', () => {
    render(
      <TableWrapper>
        <ModelRow
          {...mockModel}
          modelBeingTested={'model-to-test'}
          setModelBeingTested={() => {}}
        />
      </TableWrapper>,
    );

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
    render(
      <TableWrapper>
        <ModelRow
          {...mockModel}
          modelBeingTested={'model-to-test'}
          setModelBeingTested={() => {}}
        />
      </TableWrapper>,
    );

    const deleteButton = screen.getByTestId(`${mockModel.id}-delete`);

    expect(screen.queryByText('Delete Model')).not.toBeInTheDocument();

    await userEvent.click(deleteButton);

    waitFor(() => {
      expect(screen.queryByText('Delete Model')).toBeInTheDocument();
    });
  });
});
