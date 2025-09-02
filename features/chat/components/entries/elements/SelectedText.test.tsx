import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import SelectedText from './SelectedText';

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider withGlobalStyles withNormalizeCSS>
      {component}
    </MantineProvider>
  );
};

describe('SelectedText', () => {
  const mockOnRemove = jest.fn();
  const mockSelectedText = 'This is test text';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the selected text content', () => {
    renderWithMantine(
      <SelectedText selectedText={mockSelectedText} onRemove={mockOnRemove} />
    );

    expect(screen.getByText(/this is test text/i)).toBeInTheDocument();
  });

  it('truncates long text with ellipsis', () => {
    const longSelectedText = new Array(251).fill('a').join('');

    renderWithMantine(
      <SelectedText selectedText={longSelectedText} onRemove={mockOnRemove} />
    );

    expect(screen.getByText(/aaaa.../i)).toBeInTheDocument();
  });

  it('renders the remove button', () => {
    renderWithMantine(
      <SelectedText selectedText={mockSelectedText} onRemove={mockOnRemove} />
    );

    const removeButton = screen.getByRole('button');
    expect(removeButton).toBeInTheDocument();
  });

  it('calls onRemove with badge id when remove button is clicked', () => {
    renderWithMantine(
      <SelectedText selectedText={mockSelectedText} onRemove={mockOnRemove} />
    );

    const removeButton = screen.getByRole('button');
    fireEvent.click(removeButton);

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('displays full text when under 250 characters', () => {
    const shortSelectedText = 'Short text';

    renderWithMantine(
      <SelectedText selectedText={shortSelectedText} onRemove={mockOnRemove} />
    );

    expect(screen.getByText(/short text/i)).toBeInTheDocument();
  });
});
