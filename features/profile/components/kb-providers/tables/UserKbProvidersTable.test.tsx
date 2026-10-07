import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import UserKbProvidersTable from './UserKbProvidersTable';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import useGetUserPreselectedKnowledgeBases from '@/features/shared/api/get-user-preselected-knowledge-bases';

jest.mock('@/features/profile/components/kb-providers/tables/UserKbProviderRow.tsx', () => {
  return function MockedUserKbProviderRow() {
    return <tr><td>User KB Provider Row</td></tr>;
  };
});

jest.mock('@/features/profile/components/kb-providers/tables/UserKnowledgeBaseRow.tsx', () => {
  return function MockedUserKnowledgeBaseRow() {
    return <tr><td>User Knowledge Base Row</td></tr>;
  };
});

jest.mock('@/features/shared/api/get-user-knowledge-bases');
jest.mock('@/features/shared/api/get-user-preselected-knowledge-bases');

describe('UserKbProvidersTable', () => {

  const tooltipText = 'These knowledge base(s) are preselected when interacting with LLMs';

  const mockKnowledgeBases = [
    {
      kbProviderId: '60c410be-11b0-4b78-ad85-dceeeb0701cd',
      kbProviderLabel: 'New Hires',
      id: 'd51af818-0a29-40f6-b2bc-2b3c915d31a2',
      label: 'Onboarding Information',
    },
    {
      kbProviderId: '60c410be-11b0-4b78-ad85-dceeeb0701cd',
      kbProviderLabel: 'New Hires',
      id: 'dcbdba9a-cad9-471b-bcb7-60d0a27489e1',
      label: 'Training Tutorial',
    },
    {
      kbProviderId: 'de8db05c-5f2d-4e81-ad73-a385065da0d0',
      kbProviderLabel: 'Employee Handbook',
      id: 'a866b5e1-22ce-4f56-a2ee-43d7a7fd4fad',
      label: 'IT Policies',
    },
    {
      kbProviderId: 'de8db05c-5f2d-4e81-ad73-a385065da0d0',
      kbProviderLabel: 'Employee Handbook',
      id: '462613e8-1b6d-46f8-a36a-b80ff710089b',
      label: 'Time Reporting',
    },
  ];

  const mockPreselectedKnowledgeBases = [
    {
      id: 'd51af818-0a29-40f6-b2bc-2b3c915d31a2',
    },
    {
      id: '462613e8-1b6d-46f8-a36a-b80ff710089b',
    },
  ];

  let renderResult: RenderResult;

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetUserKnowledgeBases as jest.Mock).mockReturnValue({
      data: {
        userKnowledgeBases: mockKnowledgeBases,
      },
      isPending: false,
    });

    (useGetUserPreselectedKnowledgeBases as jest.Mock).mockReturnValue({
      data: {
        userPreselectedKnowledgeBases: mockPreselectedKnowledgeBases,
      },
      isPending: false,
    });

    renderResult = render(<UserKbProvidersTable />);
  });

  it('renders table headers', () => {
    const firstHeader = screen.getByText('Provider');
    const secondHeader = screen.getByText('Knowledge Base Name');

    expect(firstHeader).toBeInTheDocument();
    expect(secondHeader).toBeInTheDocument();
  });

  it('renders info icon', () => {
    const infoIcon = screen.getByTestId('user-kb-table-info-icon');

    expect(infoIcon).toBeInTheDocument();
  });

  it('renders tooltip text', async () => {
    const infoIcon = screen.getByTestId('user-kb-table-info-icon');

    await userEvent.hover(infoIcon);

    await waitFor(() => {
      const tooltip = screen.getByText(tooltipText);
      expect(tooltip).toBeInTheDocument();
    });
  });

  it('renders loading text if data is pending', () => {
    (useGetUserKnowledgeBases as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: true,
    });

    renderResult.rerender(<UserKbProvidersTable />);

    const loadingText = screen.getByText('Loading...');
    expect(loadingText).toBeInTheDocument();

    const table = screen.queryByTestId('user-kb-providers-table');
    expect(table).not.toBeInTheDocument();
  });

  it('renders no knowledge bases available text if no knowledge bases are available', () => {
    (useGetUserKnowledgeBases as jest.Mock).mockReturnValue({
      data: {
        userKnowledgeBases: [],
      },
      isPending: false,
    });

    renderResult.rerender(<UserKbProvidersTable />);

    const noKbText = screen.getByText('No knowledge bases available.');
    const table = screen.queryByTestId('user-kb-providers-table');
    expect(noKbText).toBeInTheDocument();
    expect(table).not.toBeInTheDocument();
  });

  it('renders correct number of UserKbProviderRow', () => {
    const kbProviderRows = screen.getAllByText('User KB Provider Row');

    const uniqueProviders = new Set(mockKnowledgeBases.map((kb) => kb.kbProviderId));
    expect(kbProviderRows).toHaveLength(uniqueProviders.size);
  });

  it('renders correct number of UserKnowledgeBaseRow', () => {
    const knowledgeBaseRows = screen.getAllByText('User Knowledge Base Row');
    expect(knowledgeBaseRows).toHaveLength(mockKnowledgeBases.length);
  });
});
