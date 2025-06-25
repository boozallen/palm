import { render, screen } from '@testing-library/react';
import useAddAiProviderModel from '@/features/settings/api/add-ai-provider-model';
import AddModelRow from './AddModelRow';

jest.mock('@/features/settings/api/add-ai-provider-model');

(useAddAiProviderModel as jest.Mock).mockReturnValue({
  mutateAsync: jest.fn(),
  isPending: false,
  error: null,
});

jest.mock('@/features/settings/utils/useTestModel', () => {
  return jest.fn(() => ({
    testModel: jest.fn(),
    error: null,
  }));
});

function TableRowWrapper({ providerId }: { providerId: string }) {
  return (
    <table>
      <tbody>
        <AddModelRow
          providerId={providerId}
          setShowAddModelRow={jest.fn()}
          setNewModelBeingTested={() => {}}
        />
      </tbody>
    </table>
  );
}

describe('AddModelRow', () => {
  it('renders the row', () => {
    const providerId = 'exampleProviderId';

    render(<TableRowWrapper providerId={providerId} />);

    // Assert that the component renders without throwing any errors
    expect(screen.getByTestId('add-provider-model-row')).toBeInTheDocument();
  });
  it('renders the form', () => {
    const providerId = 'exampleProviderId';

    render(<TableRowWrapper providerId={providerId} />);

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('External ID')).toBeInTheDocument();
  });
});
