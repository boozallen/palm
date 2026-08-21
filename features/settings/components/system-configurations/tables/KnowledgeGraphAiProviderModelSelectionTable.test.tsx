import { renderWrapper } from '@/test/test-utils';

import KnowledgeGraphAiProviderModelSelectionTable from './KnowledgeGraphAiProviderModelSelectionTable';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

jest.mock('@/features/shared/api/get-system-config');

jest.mock('@/features/settings/components/system-configurations/tables/KnowledgeGraphAiProviderModelConfigRow', () => {
  return function MockKnowledgeGraphAiProviderModelConfigRow() {
    return (
      <tr data-testid='knowledge-graph-ai-provider-model-config-row'>
        <td>
        </td>
        <td></td>
      </tr>
    );
  };
});

jest.mock('@/features/settings/components/system-configurations/tables/MemoryConfigRow', () => {
  return function MockMemoryConfigRow() {
    return (
      <tr data-testid='memory-config-row'>
        <td></td>
        <td></td>
      </tr>
    );
  };
});

describe('KnowledgeGraphAiProviderModelSelectionTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        knowledgeGraphAiProviderModelId: '2b0ef4b1-a1c7-42a0-b1fc-ad0d1b9e67dd',
        knowledgeGraphEntityResolutionEnabled: false,
        memoryEnabled: false,
      },
    });
  });

  it('should render table header', () => {
    const { queryByText } = renderWrapper(<KnowledgeGraphAiProviderModelSelectionTable />);
    expect(queryByText('Knowledge Graph (Neo4j)')).toBeInTheDocument();
    expect(queryByText('Enabled')).toBeInTheDocument();
  });

  it('renders the Graph Process Configurations and System Memory section headers', () => {
    const { getByTestId } = renderWrapper(<KnowledgeGraphAiProviderModelSelectionTable />);
    expect(getByTestId('graph-process-configurations-section-header')).toBeInTheDocument();
    expect(getByTestId('system-memory-section-header')).toBeInTheDocument();
  });

  it('displays KnowledgeGraphAiProviderModelConfigRow', () => {
    const { getByTestId } = renderWrapper(
      <KnowledgeGraphAiProviderModelSelectionTable />
    );

    expect(getByTestId('knowledge-graph-ai-provider-model-config-row')).toBeInTheDocument();
  });

  it('renders the entity resolution row', () => {
    const { queryByText } = renderWrapper(<KnowledgeGraphAiProviderModelSelectionTable />);
    expect(queryByText('Enable Entity Resolution')).toBeInTheDocument();
  });

  it('renders the memory config row', () => {
    const { getByTestId } = renderWrapper(<KnowledgeGraphAiProviderModelSelectionTable />);
    expect(getByTestId('memory-config-row')).toBeInTheDocument();
  });

  it('should display loading component when data is pending', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const { queryByText } = renderWrapper(<KnowledgeGraphAiProviderModelSelectionTable />);
    expect(queryByText('Loading...')).toBeInTheDocument();
  });

  it('should display error message when there is an error', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      error: { message: 'Error fetching system config' },
    });

    const { queryByText } = renderWrapper(<KnowledgeGraphAiProviderModelSelectionTable />);
    expect(queryByText('Error fetching system config')).toBeInTheDocument();
  });
});
