import { ThemeIcon, UnstyledButton } from '@mantine/core';
import { useContext } from 'react';
import { UserBookmarks } from '../layouts/UserBookmarks';
import { useToggleBookmark } from '@/features/library/api/toggle-bookmark';
import { notifications } from '@mantine/notifications';
import { IconBookmark, IconBookmarkFilled, IconX } from '@tabler/icons-react';

// The id here is that of the prompt being bookmarked, used for toggling the bookmark state
type BookmarkIconProps = Readonly<{
  id: string
}>;

// A user clicks this custom bookmark icon in order to save a prompt to their bookmarked prompts.
// A filled bookmark icon indicates the bookmark is saved.
export default function BookmarkIcon({ id }: BookmarkIconProps) {

  const { bookmarks, setBookmarks } = useContext(UserBookmarks);
  const { mutateAsync: toggleBookmark, error: toggleBookmarkError } = useToggleBookmark();

  const toggleBookmarkState = async (id: string) => {
    const newBookmarks = new Map(bookmarks);
    // When user clicks on the icon it will save/remove the bookmark from the DB
    try {
      await toggleBookmark({ promptId: id });
      newBookmarks.set(id, (newBookmarks.has(id)) ? !newBookmarks.get(id) : true);
      setBookmarks(newBookmarks);
    } catch (error) {
      notifications.show({
        title: 'Failed to Update Bookmark',
        message: toggleBookmarkError ? toggleBookmarkError.message : 'An unexpected error occurred. Please try again later.',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleOnClick = (event: React.MouseEvent) => {
    toggleBookmarkState(id);
    event.stopPropagation();
  };

  const getBookmarkIcon = () => {
    if (bookmarks.get(id)) {
      return (
        <ThemeIcon mt={2} c='red.8'>
          <IconBookmarkFilled />
        </ThemeIcon>
      );
    }

    return (
      <ThemeIcon mt={2}>
        <IconBookmark />
      </ThemeIcon>
    );
  };

  return (
    <UnstyledButton
      aria-label='bookmark prompt'
      onKeyDown={handleKeyDown}
      onClick={handleOnClick}
      data-testid='BookmarkIcon'
    >
      {getBookmarkIcon()}
    </UnstyledButton>
  );
}
