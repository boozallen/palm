import { useGetBookmarks } from '@/features/library/api/get-bookmarks';
import React, { createContext, useEffect, useState } from 'react';

type BookmarkWrapProps = {
  children: React.ReactNode;
};

type UserBookmarksContextType = {
  bookmarks: Map<string, boolean>,
  setBookmarks: React.Dispatch<React.SetStateAction<Map<string, boolean>>>
}

const UserBookmarksContextState: UserBookmarksContextType = {
  bookmarks: new Map(),
  setBookmarks: () => { },
};

export const UserBookmarks = createContext<UserBookmarksContextType>(UserBookmarksContextState);

export const UserBookmarksProvider = ({ children }: BookmarkWrapProps) => {

  const { data: bookmarksData } = useGetBookmarks();
  const [bookmarks, setBookmarks] = useState(new Map<string, boolean>());

  useEffect(() => {
    // when bookmarkIds load create a hash map to make assignment of bookmarks easier for prompts to render
    const bookmarksHashMap = new Map();
    (bookmarksData?.bookmarkIds.length) && bookmarksData.bookmarkIds.map(id => bookmarksHashMap.set(id, true));

    setBookmarks(bookmarksHashMap);
  }, [bookmarksData]);

  return (
    <UserBookmarks.Provider value={{ bookmarks, setBookmarks }}>
      {children}
    </UserBookmarks.Provider>
  );
};

