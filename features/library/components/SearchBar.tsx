import React, { useRef, useEffect } from 'react';
import { TextInput, ThemeIcon } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchFocused: boolean;
  setSearchFocused: (value: boolean) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchQuery, setSearchQuery, searchFocused, setSearchFocused }) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchFocused) {
      searchInputRef.current?.focus();
    }
  }, [searchFocused]);

  return (
    <TextInput
      ref={searchInputRef}
      onFocus={() => setSearchFocused(true)}
      onBlur={() => setSearchFocused(false)}
      w='310px'
      placeholder='Search a prompt'
      aria-label='Search a prompt'
      mb='0'
      icon={
        <ThemeIcon size='sm' c='gray.6'>
          <IconSearch stroke={1} />
        </ThemeIcon>
      }
      value={searchQuery}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
        setSearchQuery(event.currentTarget.value)
      }
    />
  );
};

export default SearchBar;
