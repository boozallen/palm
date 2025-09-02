import { render } from '@testing-library/react';
import PromptFormSubmissionResponse from './PromptFormSubmissionResponse';
import React from 'react';
import { AiResponse } from '@/features/ai-provider/sources/types';

describe('PromptFormSubmissionResponse', () => {
  const mockData: AiResponse = {
    text: 'Test response',
    inputTokensUsed: 0,
    outputTokensUsed: 0,
  };

  it('renders the response text', () => {
    const { getByText } = render(<PromptFormSubmissionResponse data={mockData} />);
    expect(getByText(mockData.text)).toBeInTheDocument();
  });

  it('renders the copy button', () => {
    const { getByRole } = render(<PromptFormSubmissionResponse data={mockData} />);
    const copyButton = getByRole('button');
    expect(copyButton).toBeInTheDocument();
  });

  it('renders the copy icon', () => {
    const { getByRole } = render(<PromptFormSubmissionResponse data={mockData} />);
    const copyButton = getByRole('button');
    const copyIcon = copyButton.getElementsByClassName('tabler-icon-copy');
    expect(copyIcon).toHaveLength(1);
  });

});
