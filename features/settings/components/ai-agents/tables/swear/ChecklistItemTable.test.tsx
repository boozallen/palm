import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ChecklistItemTable from './ChecklistItemTable';
import useGetSwearChecklistItems from '@/features/settings/api/ai-agents/swear/get-swear-checklist-items';

jest.mock('@/features/settings/api/ai-agents/swear/get-swear-checklist-items');
jest.mock('./ChecklistItemRow', () => {
  return function MockChecklistItemRow({
    checklistItem,
  }: {
    checklistItem: { id: string; category: string; item: string; sortOrder: number };
  }) {
    return (
      <tr data-testid={`row-${checklistItem.id}`}>
        <td>{checklistItem.category}</td>
        <td>{checklistItem.item}</td>
        <td>{checklistItem.sortOrder}</td>
        <td>Actions</td>
      </tr>
    );
  };
});
jest.mock('@/features/shared/components/Loading', () => {
  return function MockLoading() {
    return <div data-testid='loading'>Loading...</div>;
  };
});

describe('ChecklistItemTable', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';

  const mockChecklistItems = [
    {
      id: 'item-1',
      aiAgentId: mockAgentId,
      category: 'Preliminary Information',
      item: 'Item 1',
      sortOrder: 1,
    },
    {
      id: 'item-2',
      aiAgentId: mockAgentId,
      category: 'Probable Cause',
      item: 'Item 2',
      sortOrder: 1,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state', () => {
    (useGetSwearChecklistItems as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
    });

    render(<ChecklistItemTable aiAgentId={mockAgentId} />);

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should show empty message when no items', () => {
    (useGetSwearChecklistItems as jest.Mock).mockReturnValue({
      data: { checklistItems: [] },
      isPending: false,
    });

    render(<ChecklistItemTable aiAgentId={mockAgentId} />);

    expect(
      screen.getByText('No checklist items have been configured yet.')
    ).toBeInTheDocument();
  });

  it('should render table with items', () => {
    (useGetSwearChecklistItems as jest.Mock).mockReturnValue({
      data: { checklistItems: mockChecklistItems },
      isPending: false,
    });

    render(<ChecklistItemTable aiAgentId={mockAgentId} />);

    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Checklist Item')).toBeInTheDocument();
    expect(screen.getByText('Sort Order')).toBeInTheDocument();
    expect(screen.getByTestId('row-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('row-item-2')).toBeInTheDocument();
  });

  it('should paginate items', () => {
    // Create more items than fit on one page
    const manyItems = Array.from({ length: 15 }, (_, i) => ({
      id: `item-${i}`,
      aiAgentId: mockAgentId,
      category: 'Category',
      item: `Item ${i}`,
      sortOrder: i,
    }));

    (useGetSwearChecklistItems as jest.Mock).mockReturnValue({
      data: { checklistItems: manyItems },
      isPending: false,
    });

    render(<ChecklistItemTable aiAgentId={mockAgentId} />);

    // Should show pagination
    expect(screen.getByTestId('checklist-items-pagination')).toBeInTheDocument();
  });

  it('should change page when pagination clicked', async () => {
    const manyItems = Array.from({ length: 15 }, (_, i) => ({
      id: `item-${i}`,
      aiAgentId: mockAgentId,
      category: 'Category',
      item: `Item ${i}`,
      sortOrder: i,
    }));

    (useGetSwearChecklistItems as jest.Mock).mockReturnValue({
      data: { checklistItems: manyItems },
      isPending: false,
    });

    render(<ChecklistItemTable aiAgentId={mockAgentId} />);

    // Click next page
    const nextButton = screen.getByLabelText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      // Should show items from second page
      expect(screen.getByTestId('row-item-10')).toBeInTheDocument();
    });
  });

  it('should not show pagination for few items', () => {
    (useGetSwearChecklistItems as jest.Mock).mockReturnValue({
      data: { checklistItems: mockChecklistItems },
      isPending: false,
    });

    render(<ChecklistItemTable aiAgentId={mockAgentId} />);

    expect(
      screen.queryByTestId('checklist-items-pagination')
    ).not.toBeInTheDocument();
  });
});
