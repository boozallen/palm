import ReactMarkdown, { type Components } from 'react-markdown';
import { useEffect } from 'react';
import mermaid from 'mermaid';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { PluggableList } from 'unified';
import { Prism } from '@mantine/prism';

import CodeBlockWithBanner from '@/features/chat/components/content/CodeBlockWithBanner';
import { formatAsMermaid, removeTrailingNewlines, getMantinePrismLanguage } from '@/features/chat/utils/artifacts/artifactHelperFunctions';
import { stripMarkdownCodeFence } from '@/features/workflows/utils/primitive-helpers';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

// A link leaves the app when it resolves to another origin. Relative hrefs
// ('/library', '#section') resolve onto the current origin and are internal;
// mailto:/tel: resolve to a null origin and so count as external.
function isExternalHref(href: string | undefined): boolean {
  if (!href) { return false; }

  try {
    return new URL(href, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

type MarkdownProps = {
  value: string;
  fileExtension?: string;
  isPreview?: boolean;
  // Opt-in extension points. When absent, Markdown renders byte-identically to before. Used by the
  // chat message render to inject the graph-citation remark plugin + a `graphcitation` component
  // that turns inline `[[E#]]` markers into interactive anchors.
  extraRemarkPlugins?: PluggableList;
  extraComponents?: Components;
};

export default function Markdown({ value, fileExtension, isPreview, extraRemarkPlugins, extraComponents }: Readonly<MarkdownProps>) {
  const track = useTrackClientEvent();
  const isHtml = fileExtension === '.html';
  const isMermaid = fileExtension === '.mmd' || fileExtension === '.mermaid';

  const remarkPlugins: PluggableList = [remarkGfm, ...(extraRemarkPlugins ?? [])];
  const rehypePlugins: PluggableList = [];
  
  if (isMermaid && isPreview) {
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

  // Render HTML content in a sandboxed iframe
  if (isHtml && isPreview) {
    // Strip markdown code fence markers if present (e.g., ```html ... ```)
    const cleanHtml = stripMarkdownCodeFence(value);

    return (
      <iframe
        srcDoc={cleanHtml}
        sandbox='allow-same-origin allow-scripts'
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          backgroundColor: '#ffffff',
        }}
        title='HTML Preview'
      />
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
          table({ children }) {
            return (
              <div className='markdown-message-table-wrapper'>
                <table className='markdown-message-table'>
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className='markdown-message-thead'>
                {children}
              </thead>
            );
          },
          th({ children }) {
            return (
              <th className='markdown-message-th'>
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className='markdown-message-td'>
                {children}
              </td>
            );
          },
          tr({ children }) {
            return (
              <tr className='markdown-message-tr'>
                {children}
              </tr>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                onClick={() => {
                  if (isExternalHref(href)) {
                    track.externalLink(typeof children === 'string' ? children : (href ?? ''), href);
                  }
                }}
              >
                {children}
              </a>
            );
          },
          ...(extraComponents ?? {}),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
