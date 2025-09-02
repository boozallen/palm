import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import SearchBar from './SearchBar';

describe('<SearchBar />', () => {
  let searchQuery = '';
  const setSearchQuery = jest.fn((query) => {
    searchQuery = query;
  });
  let searchFocused = false;
  const setSearchFocused = jest.fn((value) => {
    searchFocused = value;
  });

  it('renders the search input with the correct placeholder', () => {
    const { getByPlaceholderText } = render(
      <SearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchFocused={searchFocused}
        setSearchFocused={setSearchFocused}
      />
    );
    expect(getByPlaceholderText('Search a prompt')).toBeTruthy();
  });

  it('calls setSearchQuery when the input value changes', () => {
    const { getByPlaceholderText } = render(
      <SearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchFocused={searchFocused}
        setSearchFocused={setSearchFocused}
      />
    );
    const input = getByPlaceholderText('Search a prompt');
    fireEvent.change(input, { target: { value: 'new query' } });
    expect(setSearchQuery).toHaveBeenCalledWith('new query');
  });

  it('calls setSearchFocused when the input is focused or blurred', () => {
    const { getByPlaceholderText } = render(
      <SearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchFocused={searchFocused}
        setSearchFocused={setSearchFocused}
      />
    );
    const input = getByPlaceholderText('Search a prompt');
    fireEvent.focus(input);
    expect(setSearchFocused).toHaveBeenCalledWith(true);
    fireEvent.blur(input);
    expect(setSearchFocused).toHaveBeenCalledWith(false);
  });

  it('focuses the input when searchFocused is true', () => {
    searchFocused = true;
    const { getByPlaceholderText } = render(
      <SearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchFocused={searchFocused}
        setSearchFocused={setSearchFocused}
      />
    );
    const input = getByPlaceholderText('Search a prompt');
    expect(document.activeElement).toBe(input);
  });
});
