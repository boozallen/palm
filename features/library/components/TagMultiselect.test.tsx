import { render, fireEvent, screen } from '@testing-library/react';
import TagMultiselect from './TagMultiselect';
import { useGetTags } from '@/features/shared/api/get-tags';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/features/shared/api/get-tags', () => ({
  useGetTags: jest.fn(),
}));

describe('<TagMultiselect />', () => {
  const mockSetFilteredTags = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without error', () => {
    (useGetTags as jest.Mock).mockReturnValue({ data: { tags: [] }, isFetching: false });

    render(
      <TagMultiselect filteredTags={[]} setFilteredTags={mockSetFilteredTags} />
    );

    expect(screen.getByLabelText('Tag')).toBeInTheDocument();
  });

  it('handles null or undefined tags data gracefully', () => {
    (useGetTags as jest.Mock).mockReturnValue({ data: null, isFetching: false });

    render(
      <TagMultiselect filteredTags={[]} setFilteredTags={mockSetFilteredTags} />
    );

    expect(screen.getByLabelText('Tag')).toBeInTheDocument();
  });

  it('displays loader when fetching tags', () => {
    (useGetTags as jest.Mock).mockReturnValue({ data: { tags: [] }, isFetching: true });

    render(
      <TagMultiselect filteredTags={[]} setFilteredTags={mockSetFilteredTags} />
    );

    expect(screen.getByRole('presentation')).toBeInTheDocument();
  });

  it('shows dropdown when input is focused', () => {
    (useGetTags as jest.Mock).mockReturnValue({
      data: { tags: ['tag1'] },
      isFetching: false,
    });

    render(<TagMultiselect filteredTags={[]} setFilteredTags={mockSetFilteredTags} />);

    const input = screen.getByPlaceholderText('Select tag(s)') as HTMLInputElement;

    fireEvent.mouseDown(input);

    const dropdown = screen.getByRole('listbox');
    expect(dropdown).toBeInTheDocument();
  });

  it('updates search query when typing in the search input', () => {
    (useGetTags as jest.Mock).mockReturnValue({ data: { tags: [] }, isFetching: false });

    render(
      <TagMultiselect filteredTags={[]} setFilteredTags={mockSetFilteredTags} />
    );

    const input = screen.getByPlaceholderText('Select tag(s)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'new tag' } });

    expect(input.value).toBe('new tag');
  });
});
