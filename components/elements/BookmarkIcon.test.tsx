import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import BookmarkIcon from './BookmarkIcon';
import { UserBookmarks } from '../layouts/UserBookmarks';
import { useToggleBookmark } from '@/features/library/api/toggle-bookmark';

jest.mock('@/features/library/api/toggle-bookmark');

jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

const mockToggleBookmark = useToggleBookmark as jest.Mock;

describe('BookmarkIcon', () => {
  const mockSetBookmarks = jest.fn();
  const mockContextValue = {
    bookmarks: new Map(),
    setBookmarks: mockSetBookmarks,
  };

  beforeEach(() => {
    mockToggleBookmark.mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(new Error('Test error')),
      error: new Error('Test error'),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows a notification when an error occurs', async () => {
    render(
      <UserBookmarks.Provider value={mockContextValue}>
        <BookmarkIcon id={'test'} />
      </UserBookmarks.Provider>
    );

    const bookmarkIcon = screen.getByTestId('BookmarkIcon');
    fireEvent.click(bookmarkIcon);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Failed to Update Bookmark',
        message: 'Test error',
        icon: expect.anything(),
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    });
  });
});
