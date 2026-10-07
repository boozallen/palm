import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Markdown from './Markdown';
import { formatAsRawText, formatAsMermaid, removeTrailingNewlines } from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

const mockCreateAuditRecord = jest.fn();

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/features/chat/utils/artifacts/artifactHelperFunctions');

// Rendered links record an EXTERNAL_NAVIGATION when they leave the app.
jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: jest.fn(() => ({ mutate: mockCreateAuditRecord })),
}));

jest.mock('@/features/workflows/utils/primitive-helpers', () => ({
  stripMarkdownCodeFence: jest.fn((text: string) => {
    const trimmed = text.trim();

    // Check if it's already valid HTML
    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html')) {
      return trimmed;
    }

    // Extract HTML from between code fences
    const codeFencePattern = /^```(?:html)?\s*\n([\s\S]*?)\n```/i;
    const match = trimmed.match(codeFencePattern);

    if (match && match[1]) {
      return match[1].trim();
    }

    return trimmed;
  }),
}));

jest.mock('@mantine/prism', () => ({
  Prism: ({ children, language, noCopy, ...props }: any) => (
    <div className='mantine-Prism-root' data-language={language} data-no-copy={noCopy} {...props}>
      {children}
    </div>
  ),
}));

describe('Markdown Component', () => {
  const mermaid = require('mermaid');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Markdown content correctly', () => {
    const markdownText = '# Test Heading\n\nThis is a paragraph.';
    const { getByTestId } = render(<Markdown value={markdownText} />);
    const reactMarkdown = getByTestId('react-markdown');

    expect(reactMarkdown).toHaveTextContent('# Test Heading');
    expect(reactMarkdown).toHaveTextContent('This is a paragraph');
  });

  it('does not render Mermaid content when isPreview is false', () => {
    const mermaidMarkdown = '<pre class="mermaid">\ngraph TD;\nA-->B;\n</pre>';
    const { container } = render(<Markdown value={mermaidMarkdown} />);

    expect(container.firstChild).toHaveClass('markdown');
    expect(mermaid.initialize).not.toHaveBeenCalled();
    expect(mermaid.contentLoaded).not.toHaveBeenCalled();
  });

  it('initializes Mermaid when fileExtension is a Mermaid type and isPreview is true', () => {
    const mermaidMarkdown = '<pre class="mermaid">\ngraph TD;\nA-->B;\n</pre>';
    render(<Markdown value={mermaidMarkdown} fileExtension='.mmd' isPreview={true} />);
    
    expect(mermaid.initialize).toHaveBeenCalledWith({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
    });
    expect(mermaid.contentLoaded).toHaveBeenCalled();
  });

  it('does not initialize Mermaid when fileExtension is not a Mermaid type', () => {
    const regularMarkdown = '# Just a heading\n\nRegular paragraph.';
    render(<Markdown value={regularMarkdown} isPreview={true} />);
    
    expect(mermaid.initialize).not.toHaveBeenCalled();
    expect(mermaid.contentLoaded).not.toHaveBeenCalled();
  });

  it('applies correct classes when fileExtension and isPreview are undefined', () => {
    const markdownText = '# Test Heading\n\nThis is a paragraph.';
    const { container } = render(<Markdown value={markdownText} />);

    expect(container.firstChild).toHaveClass('markdown');
    expect(container.firstChild).not.toHaveClass('artifact-markdown');
    expect(container.firstChild).not.toHaveClass('artifact-markdown-preview');
    expect(container.firstChild).not.toHaveClass('artifact-markdown-preview-mermaid');
  });

  it('applies correct classes when fileExtension exists and isPreview is false', () => {
    const markdownText = '# Test Heading\n\nThis is a paragraph.';
    const { container } = render(<Markdown value={markdownText} fileExtension='.md' isPreview={false} />);
 
    expect(container.firstChild).toHaveClass('markdown');
    expect(container.firstChild).toHaveClass('artifact-markdown');
    expect(container.firstChild).not.toHaveClass('artifact-markdown-preview');
    expect(container.firstChild).not.toHaveClass('artifact-markdown-preview-mermaid');
  });

  it('applies correct classes when fileExtension exists and isPreview is true', () => {
    const markdownText = '# Test Heading\n\nThis is a paragraph.';
    const { container } = render(<Markdown value={markdownText} fileExtension='.md' isPreview={true} />);

    expect(container.firstChild).toHaveClass('markdown');
    expect(container.firstChild).toHaveClass('artifact-markdown');
    expect(container.firstChild).toHaveClass('artifact-markdown-preview');
    expect(container.firstChild).not.toHaveClass('artifact-markdown-preview-mermaid');
  });

  it('applies correct classes when fileExtension exists, is a Mermaid type, and isPreview is true', () => {
    const mermaidMarkdown = '<pre class="mermaid">\ngraph TD;\nA-->B;\n</pre>';
    const { container } = render(<Markdown value={mermaidMarkdown} fileExtension='.mmd' isPreview={true} />);

    expect(container.firstChild).toHaveClass('markdown');
    expect(container.firstChild).toHaveClass('artifact-markdown');
    expect(container.firstChild).toHaveClass('artifact-markdown-preview');
    expect(container.firstChild).toHaveClass('artifact-markdown-preview-mermaid');
  });

  it('applies correct classes when fileExtension exists, is a Mermaid type, and isPreview is false', () => {
    const mermaidMarkdown = '<pre class="mermaid">\ngraph TD;\nA-->B;\n</pre>';
    const { container } = render(<Markdown value={mermaidMarkdown} fileExtension='.mermaid' isPreview={false} />);

    expect(container.firstChild).toHaveClass('markdown');
    expect(container.firstChild).toHaveClass('artifact-markdown');
    expect(container.firstChild).not.toHaveClass('artifact-markdown-preview');
    expect(container.firstChild).not.toHaveClass('artifact-markdown-preview-mermaid');
  });

  it('renders with Prism when fileExtension exists and isPreview is false', () => {
    const markdownText = '# Test Heading\n\nThis is a paragraph.';
    const { container } = render(<Markdown value={markdownText} fileExtension='.md' isPreview={false} />);

    // The component now uses Prism for syntax highlighting instead of formatAsRawText
    expect(container.querySelector('.mantine-Prism-root')).toBeInTheDocument();
  });

  it('does not format content as raw text when no fileExtension is provided', () => {
    const markdownText = '# Test Heading\n\nThis is a paragraph.';
    render(<Markdown value={markdownText} />);

    expect(formatAsRawText).not.toHaveBeenCalled();
  });

  it('formats content as mermaid when fileExtension is a Mermaid type and isPreview is true', () => {
    const mermaidMarkdown = '<pre class="mermaid">\ngraph TD;\nA-->B;\n</pre>';
    render(<Markdown value={mermaidMarkdown} fileExtension='.mmd' isPreview={true} />);

    expect(formatAsMermaid).toHaveBeenCalledWith(mermaidMarkdown);
  });

  it('renders with Prism when fileExtension is a Mermaid type and isPreview is false', () => {
    const mermaidMarkdown = '<pre class="mermaid">\ngraph TD;\nA-->B;\n</pre>';
    const { container } = render(<Markdown value={mermaidMarkdown} fileExtension='.mmd' isPreview={false} />);

    // The component now uses Prism for syntax highlighting instead of formatAsRawText
    expect(container.querySelector('.mantine-Prism-root')).toBeInTheDocument();
    expect(formatAsMermaid).not.toHaveBeenCalled();
  });

  it('calls removeTrailingNewlines', () => {
    const codeMarkdown = '```javascript\nconst test = "hello";\n\n```';
    render(<Markdown value={codeMarkdown} />);
    
    expect(removeTrailingNewlines).toHaveBeenCalledWith('const test = "hello";');
  });

  it('renders CodeBlockWithBanner for block-level elements', () => {
    const codeMarkdown = '```javascript\nconst test = "hello";\n```';
    const { getByTestId } = render(<Markdown value={codeMarkdown} />);
    
    const codeBlockWithBanner = getByTestId('codeblock-with-banner');
    expect(codeBlockWithBanner).toBeInTheDocument();
  });
  
  it('does not render CodeBlockWithBanner for inline elements', () => {
    const markdownWithInlineCode = 'This is `inline code` in a paragraph';
    const { container, queryByTestId } = render(<Markdown value={markdownWithInlineCode} />);
    
    const codeBlockWithBanner = queryByTestId('codeblock-with-banner');
    expect(codeBlockWithBanner).not.toBeInTheDocument();
    
    expect(container.firstChild).toHaveClass('markdown');
  });
  
  it('does not render CodeBlockWithBanner when fileExtension exists', () => {
    const codeMarkdown = '```javascript\nconst test = "hello";\n```';
    const { queryByTestId } = render(<Markdown value={codeMarkdown} fileExtension='.js' isPreview={true} />);

    const codeBlockWithBanner = queryByTestId('codeblock-with-banner');
    expect(codeBlockWithBanner).not.toBeInTheDocument();
  });

  it('strips markdown code fence markers from HTML preview', () => {
    const htmlWithFence = '```html\n<!DOCTYPE html><html><body><h1>Test</h1></body></html>\n```';
    const { container } = render(<Markdown value={htmlWithFence} fileExtension='.html' isPreview={true} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('srcDoc')).toBe('<!DOCTYPE html><html><body><h1>Test</h1></body></html>');
    expect(iframe?.getAttribute('srcDoc')).not.toContain('```');
  });

  it('renders HTML without code fence markers unchanged', () => {
    const cleanHtml = '<!DOCTYPE html><html><body><h1>Test</h1></body></html>';
    const { container } = render(<Markdown value={cleanHtml} fileExtension='.html' isPreview={true} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('srcDoc')).toBe(cleanHtml);
  });

  it('extracts HTML from code fence and ignores explanatory text after', () => {
    const htmlWithExtraText = `\`\`\`html
<!DOCTYPE html><html><body><h1>Pawsome Daycare</h1></body></html>
\`\`\`

This complete HTML page includes:
- Professional Design Features
- All Required Elements`;
    const expectedHtml = '<!DOCTYPE html><html><body><h1>Pawsome Daycare</h1></body></html>';
    const { container } = render(<Markdown value={htmlWithExtraText} fileExtension='.html' isPreview={true} />);

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('srcDoc')).toBe(expectedHtml);
    expect(iframe?.getAttribute('srcDoc')).not.toContain('This complete HTML page');
  });

  it('records an external navigation when a link leaving the app is clicked', () => {
    render(<Markdown value='[Anthropic](https://www.anthropic.com/news)' />);

    fireEvent.click(screen.getByRole('link'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.ExternalNavigation,
      label: 'Anthropic',
      href: 'https://www.anthropic.com/news',
    });
  });

  it('does not record an external navigation for an in-app link', () => {
    render(<Markdown value='[Prompt Library](/library)' />);

    fireEvent.click(screen.getByRole('link'));

    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('does not record an external navigation for an absolute link on the current origin', () => {
    render(<Markdown value={`[Prompt](${window.location.origin}/library/prompt/1)`} />);

    fireEvent.click(screen.getByRole('link'));

    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('does not record an external navigation for a hash link', () => {
    render(<Markdown value='[Access control](#access-control)' />);

    fireEvent.click(screen.getByRole('link'));

    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });

  it('records an external navigation for a mailto link, which can never be an in-app page', () => {
    render(<Markdown value='[Email us](mailto:support@example.com)' />);

    fireEvent.click(screen.getByRole('link'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.ExternalNavigation,
      label: 'Email us',
      href: 'mailto:support@example.com',
    });
  });
});
