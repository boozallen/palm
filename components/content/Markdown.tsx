import ReactMarkdown from 'react-markdown';
import { useEffect } from 'react';
import mermaid from 'mermaid';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { PluggableList } from 'unified';
import { Prism } from '@mantine/prism';

import CodeBlockWithBanner from '@/components/content/CodeBlockWithBanner';
import { formatAsMermaid, removeTrailingNewlines, getMantinePrismLanguage } from '@/features/chat/utils/artifactHelperFunctions';

type MarkdownProps = {
  value: string;
  fileExtension?: string;
  isPreview?: boolean;
};

export default function Markdown({ value, fileExtension, isPreview }: Readonly<MarkdownProps>) {
  const isMermaid = fileExtension === '.mmd' || fileExtension === '.mermaid';

  const remarkPlugins: PluggableList = [];
  const rehypePlugins: PluggableList = [];
  
  if (isMermaid && isPreview) {
    remarkPlugins.push(remarkGfm);
    rehypePlugins.push(rehypeRaw);
  }

  let classes = 'markdown';
  if (fileExtension) {
    classes += ' artifact-markdown';
    if (isPreview) {
      classes += ' artifact-markdown-preview';
      if (isMermaid) {
        classes += ' artifact-markdown-preview-mermaid';
        value = formatAsMermaid(value);
      }
    }
  }

  useEffect(() => {
    if (isPreview && isMermaid) {
      mermaid.initialize({
        startOnLoad: true,
        theme: 'dark',
        securityLevel: 'loose',
      });
      mermaid.contentLoaded();
    }
  }, [value, isPreview, isMermaid]);

  // Use Prism syntax highlighting for valid file extensions
  if (fileExtension && !isPreview) {
    const prismLanguage = getMantinePrismLanguage(fileExtension);
    return (
      <div className={classes}>
        <Prism language={prismLanguage as any} noCopy={true}>
          {value}
        </Prism>
      </div>
    );
  }

  return (
    <div className={classes}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          code({ className, children }) {
            const language = className && className.length && className.split('language-')[1];
            const value = removeTrailingNewlines(String(children));

            if (fileExtension || !language) {
              return <span>{children}</span>;
            }

            return <CodeBlockWithBanner value={value} language={language}/>;
          },
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
