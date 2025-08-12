import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/router';

import ChatKnowledgeBasesSelect from './ChatKnowledgeBasesSelect';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import useGetUserPreselectedKnowledgeBases from '@/features/shared/api/get-user-preselected-knowledge-bases';

jest.mock('@/features/shared/api/get-user-knowledge-bases');
jest.mock('@/features/shared/api/get-user-preselected-knowledge-bases');

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('ChatKnowledgeBasesSelect', () => {

  const testId = 'knowledge-bases-select';

  const mockUserKnowledgeBases = [
    {
      id: 'ec6bbcfb-39f9-49ad-84f1-3a9441551534',
      label: 'Minimal Risk Assessment',
      kbProviderId: 'd24e5c3e-52da-4f26-883b-2dfecc133b7c',
      kbProviderLabel: 'Avengers',
    },
    {
      id: 'af47d388-8960-430c-9ee2-eb9a541a7e29',
      label: 'Infinity Stones Wiki',
      kbProviderId: 'd24e5c3e-52da-4f26-883b-2dfecc133b7c',
      kbProviderLabel: 'Avengers',
    },
    {
      id: '7d9914b4-a89d-4ea9-adb0-dcb94d32a0fb',
      label: 'Death Star User Guide',
      kbProviderId: 'f3d790f5-0099-4fa4-a4ca-759cd573e1a1',
      kbProviderLabel: 'Empire',
    },
    {
      id: '0287e11d-787e-48ce-bb59-6f1843c61241',
      label: 'Stormtrooper Training Manual',
      kbProviderId: 'f3d790f5-0099-4fa4-a4ca-759cd573e1a1',
      kbProviderLabel: 'Empire',
    },
  ];

  const mockPreselectedKnowledgeBases = [
    {
      id: '0287e11d-787e-48ce-bb59-6f1843c61241',
    },
    {
      id: 'af47d388-8960-430c-9ee2-eb9a541a7e29',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue({
      query: {
        chatId: undefined,
        knowledgeBaseId: mockPreselectedKnowledgeBases[0].id,
      },
    });

    (useGetUserKnowledgeBases as jest.Mock).mockReturnValue({
      data: {
        userKnowledgeBases: mockUserKnowledgeBases,
      },
      isPending: false,
      error: null,
    });

    (useGetUserPreselectedKnowledgeBases as jest.Mock).mockReturnValue({
      data: {
        userPreselectedKnowledgeBases: mockPreselectedKnowledgeBases,
      },
      isPending: false,
      error: null,
    });
  });

  it('renders select component', () => {
    render(<ChatKnowledgeBasesSelect />);

    const selectComponent = screen.getByTestId(testId);
    expect(selectComponent).toBeInTheDocument();
    expect(selectComponent).toHaveAttribute('placeholder', 'Select knowledge base(s)');
  });

  it('renders loading text if data is pending', () => {
    (useGetUserKnowledgeBases as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    render(<ChatKnowledgeBasesSelect />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays correct options', async () => {
    render(<ChatKnowledgeBasesSelect />);

    const input = screen.getByTestId(testId);

    await userEvent.click(input);

    // Wait for options to be displayed
    await waitFor(async () => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    mockUserKnowledgeBases.forEach((knowledgeBase) => {
      expect(screen.getByText(knowledgeBase.label)).toBeInTheDocument();
      expect(screen.getByText(knowledgeBase.kbProviderLabel)).toBeInTheDocument();
    });
  });
});
