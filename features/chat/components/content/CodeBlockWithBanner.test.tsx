import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import CodeBlockWithBanner from '@/features/chat/components/content/CodeBlockWithBanner';
import Markdown from '@/components/content/Markdown';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

const mockCreateAuditRecord = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: () => ({ mutate: mockCreateAuditRecord }),
}));

jest.mock('@mantine/prism', () => ({
  Prism: ({ children, language, noCopy, ...props }: any) => (
    <div className='mantine-Prism-root' data-language={language} data-no-copy={noCopy} {...props}>
      {children}
    </div>
  ),
}));

jest.mock('@/features/chat/utils/artifacts/artifactHelperFunctions', () => ({
  formatAsRawText: jest.fn(),
  formatAsMermaid: jest.fn(),
  removeTrailingNewlines: jest.fn((str: string) => str.trim()),
}));

jest.mock('mermaid', () => ({
  initialize: jest.fn(),
  contentLoaded: jest.fn(),
}));

describe('CodeBlockWithBanner Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('records an audit record naming the language when the copy button is clicked', () => {
    render(<CodeBlockWithBanner value={'const test = 1;'} language='javascript' />);

    fireEvent.click(screen.getByTestId('codeblock-copy-button'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.CopyContentToClipboard,
      label: 'javascript code block',
    });
  });
});
