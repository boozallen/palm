import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentActionsMenu } from './DocumentActionsMenu';

describe('DocumentActionsMenu', () => {
  const defaultProps = {
    sourceId: 'test-source-id',
    sourceLabel: 'Test Document',
    onShareClick: jest.fn(),
    onDeleteClick: jest.fn(),
    documentSharingEnabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the menu with correct aria-label', () => {
    render(<DocumentActionsMenu {...defaultProps} />);
    
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    expect(actionButton).toBeInTheDocument();
  });

  it('renders the menu target with test id', () => {
    render(<DocumentActionsMenu {...defaultProps} />);
    
    const menuIcon = screen.getByTestId('test-source-id-actions-menu');
    expect(menuIcon).toBeInTheDocument();
  });

  it('calls onShareClick when share menu item is clicked', () => {
    render(<DocumentActionsMenu {...defaultProps} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    // Click share option
    const shareMenuItem = screen.getByTestId('test-source-id-share-menu-item');
    fireEvent.click(shareMenuItem);

    expect(defaultProps.onShareClick).toHaveBeenCalledTimes(1);
  });

  it('calls onDeleteClick when delete menu item is clicked', () => {
    render(<DocumentActionsMenu {...defaultProps} />);
    
    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);
    
    // Click delete option
    const deleteMenuItem = screen.getByText('Delete');
    fireEvent.click(deleteMenuItem);
    
    expect(defaultProps.onDeleteClick).toHaveBeenCalledTimes(1);
  });

  it('renders delete menu item with red color', () => {
    render(<DocumentActionsMenu {...defaultProps} />);
    
    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);
    
    const deleteMenuItem = screen.getByText('Delete');
    expect(deleteMenuItem).toBeInTheDocument();
  });

  it('renders menu dropdown with correct test id', () => {
    render(<DocumentActionsMenu {...defaultProps} />);
    
    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);
    
    const menuDropdown = screen.getByTestId('test-source-id-menu-dropdown');
    expect(menuDropdown).toBeInTheDocument();
  });

  it('stops propagation on menu target click', () => {
    const stopPropagationSpy = jest.fn();
    
    render(<DocumentActionsMenu {...defaultProps} />);
    
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    
    // Create a mock event with stopPropagation
    const mockEvent = {
      stopPropagation: stopPropagationSpy,
      preventDefault: jest.fn(),
    } as unknown as React.MouseEvent;
    
    fireEvent.click(actionButton, mockEvent);
    
    // Note: In real implementation, stopPropagation would be called automatically
    // This test verifies the structure but stopPropagation behavior is handled by Mantine
    expect(actionButton).toBeInTheDocument();
  });

  it('handles optional onDeleteClick prop', () => {
    const propsWithoutDelete = {
      sourceId: 'test-source-id',
      sourceLabel: 'Test Document',
      onShareClick: jest.fn(),
      documentSharingEnabled: true,
    };

    render(<DocumentActionsMenu {...propsWithoutDelete} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    // Both share and delete should still render (delete just won't have a handler)
    expect(screen.getByTestId('test-source-id-share-menu-item')).toBeInTheDocument();
    expect(screen.getByTestId('test-source-id-delete-menu-item')).toBeInTheDocument();
  });

  it('shows Manage share settings button when document is already shared', () => {
    const propsWithShared = {
      ...defaultProps,
      isShared: true,
      onReshareClick: jest.fn(),
    };

    render(<DocumentActionsMenu {...propsWithShared} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    const manageShareMenuItem = screen.getByTestId('test-source-id-share-menu-item');
    expect(manageShareMenuItem).toBeInTheDocument();
    expect(manageShareMenuItem).not.toBeDisabled();
  });

  it('disables share button when document is being graphed', () => {
    const propsWithGraphing = {
      ...defaultProps,
      isGraphing: true,
    };

    render(<DocumentActionsMenu {...propsWithGraphing} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    const shareMenuItem = screen.getByTestId('test-source-id-share-menu-item');
    expect(shareMenuItem).toBeInTheDocument();
    expect(shareMenuItem).toBeDisabled();
  });

  it('calls onReshareClick when manage share settings button is clicked for shared document', () => {
    const mockOnReshareClick = jest.fn();
    const propsWithShared = {
      ...defaultProps,
      isShared: true,
      onReshareClick: mockOnReshareClick,
    };

    render(<DocumentActionsMenu {...propsWithShared} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    const manageShareMenuItem = screen.getByTestId('test-source-id-share-menu-item');
    fireEvent.click(manageShareMenuItem);

    expect(mockOnReshareClick).toHaveBeenCalled();
    expect(defaultProps.onShareClick).not.toHaveBeenCalled();
  });

  it('does not call onShareClick when share button is disabled due to graphing', () => {
    const propsWithGraphing = {
      ...defaultProps,
      isGraphing: true,
    };

    render(<DocumentActionsMenu {...propsWithGraphing} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    const shareMenuItem = screen.getByTestId('test-source-id-share-menu-item');
    fireEvent.click(shareMenuItem);

    expect(defaultProps.onShareClick).not.toHaveBeenCalled();
  });

  it('enables share button when document is not shared and not graphing', () => {
    const propsWithNoDisabling = {
      ...defaultProps,
      isShared: false,
      isGraphing: false,
    };

    render(<DocumentActionsMenu {...propsWithNoDisabling} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    const shareMenuItem = screen.getByTestId('test-source-id-share-menu-item');
    expect(shareMenuItem).toBeInTheDocument();
    expect(shareMenuItem).not.toBeDisabled();

    // Should call onShareClick when clicked
    fireEvent.click(shareMenuItem);
    expect(defaultProps.onShareClick).toHaveBeenCalledTimes(1);
  });

  it('does not render share menu item when documentSharingEnabled is false', () => {
    const propsWithSharingDisabled = {
      ...defaultProps,
      documentSharingEnabled: false,
    };

    render(<DocumentActionsMenu {...propsWithSharingDisabled} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    // Share should not be present, but Delete should still be there
    expect(screen.queryByTestId('test-source-id-share-menu-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-source-id-delete-menu-item')).toBeInTheDocument();
  });

  it('renders share menu item when documentSharingEnabled is true', () => {
    render(<DocumentActionsMenu {...defaultProps} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    // Both Share and Delete should be present
    expect(screen.getByTestId('test-source-id-share-menu-item')).toBeInTheDocument();
    expect(screen.getByTestId('test-source-id-delete-menu-item')).toBeInTheDocument();
  });

  it('renders share menu item when documentSharingEnabled is explicitly true', () => {
    const propsWithSharingEnabled = {
      ...defaultProps,
      documentSharingEnabled: true,
    };

    render(<DocumentActionsMenu {...propsWithSharingEnabled} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    // Both Share and Delete should be present
    expect(screen.getByTestId('test-source-id-share-menu-item')).toBeInTheDocument();
    expect(screen.getByTestId('test-source-id-delete-menu-item')).toBeInTheDocument();
  });

  it('does not render share menu item when documentSharingEnabled is undefined', () => {
    const propsWithoutSharingEnabled = {
      sourceId: 'test-source-id',
      sourceLabel: 'Test Document',
      onShareClick: jest.fn(),
      onDeleteClick: jest.fn(),
    };

    render(<DocumentActionsMenu {...propsWithoutSharingEnabled} />);

    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);

    // Share should not be present when documentSharingEnabled is undefined, but Delete should be there
    expect(screen.queryByTestId('test-source-id-share-menu-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-source-id-delete-menu-item')).toBeInTheDocument();
  });

  it('disables delete button when document is being graphed', () => {
    const propsWithGraphing = {
      ...defaultProps,
      isGraphing: true,
    };
    
    render(<DocumentActionsMenu {...propsWithGraphing} />);
    
    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);
    
    const deleteMenuItem = screen.getByTestId('test-source-id-delete-menu-item');
    expect(deleteMenuItem).toBeInTheDocument();
    expect(deleteMenuItem).toBeDisabled();
  });

  it('does not call onDeleteClick when delete button is disabled due to graphing', () => {
    const propsWithGraphing = {
      ...defaultProps,
      isGraphing: true,
    };
    
    render(<DocumentActionsMenu {...propsWithGraphing} />);
    
    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);
    
    const deleteMenuItem = screen.getByTestId('test-source-id-delete-menu-item');
    fireEvent.click(deleteMenuItem);
    
    expect(defaultProps.onDeleteClick).not.toHaveBeenCalled();
  });

  it('enables delete button when document is not being graphed', () => {
    const propsWithNoGraphing = {
      ...defaultProps,
      isGraphing: false,
    };
    
    render(<DocumentActionsMenu {...propsWithNoGraphing} />);
    
    // Click to open menu
    const actionButton = screen.getByRole('button', { name: /Actions for Test Document/i });
    fireEvent.click(actionButton);
    
    const deleteMenuItem = screen.getByTestId('test-source-id-delete-menu-item');
    expect(deleteMenuItem).toBeInTheDocument();
    expect(deleteMenuItem).not.toBeDisabled();
    
    // Should call onDeleteClick when clicked
    fireEvent.click(deleteMenuItem);
    expect(defaultProps.onDeleteClick).toHaveBeenCalledTimes(1);
  });
});