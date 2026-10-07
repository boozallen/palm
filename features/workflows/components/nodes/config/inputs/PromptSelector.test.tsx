import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { trpc } from '@/libs';
import PromptSelector from './PromptSelector';
import { renderWrapper } from '@/test/test-utils';

jest.mock('@/libs', () => ({
  trpc: {
    library: {
      getPrompts: {
        useQuery: jest.fn(),
      },
    },
  },
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const mockPrompts = [
  { id: '1', title: 'Prompt One', summary: 'First summary', instructions: 'Do thing one' },
  { id: '2', title: 'Prompt Two', summary: 'Second summary', instructions: 'Do thing two' },
];

describe('PromptSelector', () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (trpc.library.getPrompts.useQuery as jest.Mock).mockReturnValue({
      data: { prompts: mockPrompts },
      isLoading: false,
    });
  });

  it('renders with the correct label', () => {
    renderWrapper(<PromptSelector onSelect={onSelect} />);

    expect(screen.getByText('Select from Prompt Library')).toBeInTheDocument();
    expect(screen.getByTestId('prompt-selector')).toBeInTheDocument();
  });

  it('disables the select while loading', () => {
    (trpc.library.getPrompts.useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderWrapper(<PromptSelector onSelect={onSelect} />);

    expect(screen.getByTestId('prompt-selector')).toBeDisabled();
  });

  it('enables the select once loaded', () => {
    renderWrapper(<PromptSelector onSelect={onSelect} />);

    expect(screen.getByTestId('prompt-selector')).toBeEnabled();
  });

  it('calls onSelect with the prompt instructions when a prompt is selected', async () => {
    renderWrapper(<PromptSelector onSelect={onSelect} />);

    fireEvent.mouseDown(screen.getByTestId('prompt-selector'));

    const option = await screen.findByText('Prompt One');
    fireEvent.mouseDown(option);

    expect(onSelect).toHaveBeenCalledWith('Do thing one');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect with the correct instructions for each prompt', async () => {
    renderWrapper(<PromptSelector onSelect={onSelect} />);

    fireEvent.mouseDown(screen.getByTestId('prompt-selector'));

    const option = await screen.findByText('Prompt Two');
    fireEvent.mouseDown(option);

    expect(onSelect).toHaveBeenCalledWith('Do thing two');
  });

  it('does not call onSelect when selection is cleared', async () => {
    const user = userEvent.setup();
    renderWrapper(<PromptSelector onSelect={onSelect} />);

    // Select a prompt first
    fireEvent.mouseDown(screen.getByTestId('prompt-selector'));
    fireEvent.mouseDown(await screen.findByText('Prompt One'));
    expect(onSelect).toHaveBeenCalledTimes(1);

    // Clear the selection — Mantine v6 clear button has no accessible name, just an SVG icon
    const clearButton = screen.getByRole('button');
    await user.click(clearButton);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows "No prompts found" message when the prompt list is empty', async () => {
    (trpc.library.getPrompts.useQuery as jest.Mock).mockReturnValue({
      data: { prompts: [] },
      isLoading: false,
    });

    renderWrapper(<PromptSelector onSelect={onSelect} />);

    fireEvent.mouseDown(screen.getByTestId('prompt-selector'));

    expect(
      await screen.findByText('No prompts found. Create one in the Prompt Library first.')
    ).toBeInTheDocument();
  });

  it('renders without error when data is undefined', () => {
    (trpc.library.getPrompts.useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    renderWrapper(<PromptSelector onSelect={onSelect} />);

    expect(screen.getByTestId('prompt-selector')).toBeInTheDocument();
  });
});
