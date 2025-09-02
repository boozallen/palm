import { render, screen } from '@testing-library/react';

import { usePromptDetails } from '@/features/library/providers/PromptDetailsProvider';
import PromptDetailsHeader from './PromptDetailsHeader';

jest.mock('@/features/library/providers/PromptDetailsProvider');

let bookmarkId: string = '';
jest.mock('@/components/elements/BookmarkIcon', () => {
  return jest.fn((props) => {
    bookmarkId = props.id;
    return <div>BookmarkIcon</div>;
  });
});

let renderedTags: string[] = [];
jest.mock('@/components/elements/TagBadges', () => {
  return jest.fn((props) => {
    renderedTags.push(...props.tags);
    return <div>TagBadges</div>;
  });
});

jest.mock('./buttons/SaveCustomizedPromptButton', () => {
  return jest.fn(() => <button>Save Customized Prompt</button>);
});

const mockPrompt = {
  id: 'test-id',
  title: 'Test Title',
  summary: 'Test Summary',
  description: 'Test Description',
  tags: ['tag1', 'tag2'],
};

describe('PromptDetailsHeader', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    (usePromptDetails as jest.Mock).mockReturnValue({
      prompt: mockPrompt,
    });
  });

  afterEach(() => {
    bookmarkId = '';
    renderedTags = [];
  });

  it('renders prompt details', () => {
    render(<PromptDetailsHeader />);

    expect(screen.getByRole('heading', { name: mockPrompt.title })).toBeInTheDocument();
    expect(screen.getByText(mockPrompt.summary)).toBeInTheDocument();
    expect(screen.getByText(mockPrompt.description)).toBeInTheDocument();
    expect(renderedTags).toEqual(mockPrompt.tags);
  });

  it('renders save customized prompt button', () => {
    render(<PromptDetailsHeader />);

    expect(screen.getByText('Save Customized Prompt')).toBeInTheDocument();
  });

  it('renders bookmark icon', () => {
    render(<PromptDetailsHeader />);

    expect(screen.getByText('BookmarkIcon')).toBeInTheDocument();
  });

  it('calls bookmark icon with correct id', () => {
    render(<PromptDetailsHeader />);

    expect(bookmarkId).toEqual(mockPrompt.id);
  });
});
