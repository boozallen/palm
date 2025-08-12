import { render, screen } from '@testing-library/react';

import KbProviderRow from './KbProviderRow';
import useDeleteKbProvider from '@/features/settings/api/delete-kb-provider';
import useUpdateKbProvider from '@/features/settings/api/update-kb-provider';
import useGetKbProvider from '@/features/settings/api/get-kb-provider';

jest.mock('@/features/settings/api/get-kb-provider');
jest.mock('@/features/settings/api/delete-kb-provider');
jest.mock('@/features/settings/api/update-kb-provider');

describe('KbProviderRow', () => {
  const kbProvider = {
    id: '60c410be-11b0-4b78-ad85-dceeeb0701cd',
    label: 'New Hires',
    updatedAt: new Date('2021-06-11T14:00:00Z').toString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetKbProvider as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
      error: null,
    });

    (useDeleteKbProvider as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
      error: null,
    });

    (useUpdateKbProvider as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
      error: null,
    });

    render(
      <table>
        <tbody>
          <KbProviderRow kbProvider={kbProvider} setShowAddKnowledgeBaseRow={() => { }} />
        </tbody>
      </table>
    );
  });

  it('should render the label', () => {
    expect(screen.getByText(kbProvider.label)).toBeInTheDocument();
  });

  it('should render the actions menu', () => {
    const menu = screen.getByTestId(`${kbProvider.id}-actions-menu`);
    expect(menu).toBeInTheDocument();
  });
});
