import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CodeBlockWithBanner from './CodeBlockWithBanner';
import Markdown from './Markdown';

describe('CodeBlockWithBanner Component', () => {
  it('renders code block with language label and copy button', () => {
    const language = 'javascript';
    const value = 'const test = "hello";';
    render(<CodeBlockWithBanner value={value} language={language} />);

    const codeBlock = screen.getByTestId('codeblock-with-banner');
    expect(codeBlock).toBeInTheDocument();

    const languageLabel = screen.getByTestId('language-label');
    expect(languageLabel).toHaveTextContent(language);

    const copyButton = screen.getByTestId('codeblock-copy-button');
    expect(copyButton).toBeInTheDocument();
  });

  it('renders code blocks with different languages correctly', () => {
    const language = 'python';
    const value = 'def test():\n    return "hello"';
    render(<CodeBlockWithBanner value={value} language={language} />);

    const languageLabel = screen.getByTestId('language-label');
    expect(languageLabel).toHaveTextContent(language);
  });

  it('handles copy button click action', () => {
    const codeMarkdown = '```javascript\nconst test = "hello";\n```';
    const { getByTestId } = render(<Markdown value={codeMarkdown} />);
    
    const copyButton = getByTestId('codeblock-copy-button');
    fireEvent.click(copyButton);
    
    expect(copyButton).toBeInTheDocument();
  });
});
