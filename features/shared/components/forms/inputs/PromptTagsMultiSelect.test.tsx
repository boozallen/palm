import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptTagsMultiSelect from './PromptTagsMultiSelect';
import { useForm, UseFormReturnType } from '@mantine/form';
import { useGetTags } from '@/features/shared/api/get-tags';
import { PromptFormValues } from '@/features/shared/types';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/form', () => ({
  useForm: jest.fn(),
}));

jest.mock('@/features/shared/api/get-tags');

const mockForm: UseFormReturnType<PromptFormValues> = {
  values: { tags: [] },
  setFieldValue: jest.fn(),
  setFieldError: jest.fn(),
  getInputProps: jest.fn().mockReturnValue({}),
} as unknown as UseFormReturnType<PromptFormValues>;

describe('PromptTagsMultiSelect', () => {
  beforeEach(() => {
    (useForm as jest.Mock).mockReturnValue(mockForm);
    (useGetTags as jest.Mock).mockReturnValue({
      data: { tags: ['tag1', 'tag2'] },
      refetch: jest.fn(),
      isFetching: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component', () => {
    const { getByTestId } = render(<PromptTagsMultiSelect form={mockForm} />);
    expect(getByTestId('prompt-tags-multiselect')).toBeInTheDocument();
  });

  it('displays tag options', async () => {
    render(<PromptTagsMultiSelect form={mockForm} />);
    const input = screen.getByLabelText('Tags');
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
    });
  });

  it('handles tag selection', async () => {
    render(<PromptTagsMultiSelect form={mockForm} />);
    const input = screen.getByLabelText('Tags');
    await userEvent.click(input);
    await userEvent.click(screen.getByText('tag1'));

    await waitFor(() => {
      expect(mockForm.setFieldValue).toHaveBeenCalledWith('tags', ['tag1']);
    });
  });

  it('searches for tags', async () => {
    render(<PromptTagsMultiSelect form={mockForm} />);
    const input = screen.getByLabelText('Tags');
    await userEvent.click(input);
    await userEvent.type(input, 'tag1');

    await waitFor(() => {
      expect(screen.getByText('tag1')).toBeVisible();
      expect(screen.queryByText('tag2')).toBeNull();
    });
  });

  it('shows loader when fetching tags', () => {
    (useGetTags as jest.Mock).mockReturnValue({
      data: { tags: [] },
      refetch: jest.fn(),
      isFetching: true,
    });

    const { getByTestId } = render(<PromptTagsMultiSelect form={mockForm} />);
    expect(getByTestId('tag-search-loader')).toBeInTheDocument();
  });
});
