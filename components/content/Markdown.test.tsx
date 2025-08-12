import React from 'react';
import { render } from '@testing-library/react';
import Markdown from './Markdown';
import { formatAsRawText, formatAsMermaid, removeTrailingNewlines } from '@/features/chat/utils/artifactHelperFunctions';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@/features/chat/utils/artifactHelperFunctions');

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

  it('formats content as raw text when fileExtension exists and isPreview is false', () => {
    const markdownText = '# Test Heading\n\nThis is a paragraph.';
    render(<Markdown value={markdownText} fileExtension='.md' isPreview={false} />);

    expect(formatAsRawText).toHaveBeenCalledWith(markdownText, '.md');
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

  it('formats content as raw text when fileExtension is a Mermaid type and isPreview is false', () => {
    const mermaidMarkdown = '<pre class="mermaid">\ngraph TD;\nA-->B;\n</pre>';
    render(<Markdown value={mermaidMarkdown} fileExtension='.mmd' isPreview={false} />);

    expect(formatAsRawText).toHaveBeenCalledWith(mermaidMarkdown, '.mmd');
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
});
