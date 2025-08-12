import { render, screen } from '@testing-library/react';
import AddKnowledgeBaseRow from './AddKnowledgeBaseRow';

jest.mock('@/features/settings/api/create-knowledge-base');

jest.mock('@/features/settings/components/kb-providers/forms/AddKnowledgeBaseForm', () => {
  return function MockAddKnowledgeBaseForm() {
    return <div data-testid='add-knowledge-base-form'></div>;
  };
});

function TableRowWrapper({ kbProviderId }: { kbProviderId: string }) {
  return (
    <table>
      <tbody>
        <AddKnowledgeBaseRow kbProviderId={kbProviderId} setShowAddKnowledgeBaseRow={jest.fn()} />
      </tbody>
    </table>
  );
}

const kbProviderId = '196ff576-073d-4867-8ad7-ea2f5fbc6fbc';

describe('AddKnowledgeBaseRow', () => {
  it('renders the row', () => {
    render(<TableRowWrapper kbProviderId={kbProviderId} />);
    expect(screen.getByTestId('add-knowledge-base-row')).toBeInTheDocument();
  });

  it('renders the AddKnowledgeBaseForm', () => {
    render(<TableRowWrapper kbProviderId={kbProviderId} />);
    expect(screen.getByTestId('add-knowledge-base-form')).toBeInTheDocument();
  });
});
