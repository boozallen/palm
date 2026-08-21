import { render, fireEvent } from '@testing-library/react';
import PromptTabFilterContainer from './PromptTabFilterContainer';

const mockHandleTabChange = jest.fn();

describe('<PromptTabFilterContainer />', () => {
  it('should render "All prompts", "Owned prompts" and "Bookmarked prompts" as tab options', () => {
    const { getByText } = render(<PromptTabFilterContainer onTabChange={mockHandleTabChange} defaultValue='all' />);
    expect(getByText('All Prompts')).toBeInTheDocument();
    expect(getByText('Owned Prompts')).toBeInTheDocument();
    expect(getByText('Bookmarked Prompts')).toBeInTheDocument();
  });

  it('should call onTabChange with the new tab value when a tab is clicked', () => {
    const { getByText } = render(<PromptTabFilterContainer onTabChange={mockHandleTabChange} defaultValue='all' />);
    fireEvent.click(getByText('All Prompts'));
    expect(mockHandleTabChange).toHaveBeenCalledWith('all');
    fireEvent.click(getByText('Bookmarked Prompts'));
    expect(mockHandleTabChange).toHaveBeenCalledWith('bookmarked');
    fireEvent.click(getByText('Owned Prompts'));
    expect(mockHandleTabChange).toHaveBeenCalledWith('owned');
  });
});
