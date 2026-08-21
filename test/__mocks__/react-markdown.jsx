function ReactMarkdown({ children, components }) {
  if (components && components.code) {
    const codeProps = {
      node: {},
      inline: false,
      className: '',
      children: '',
    };

    if (children && typeof children === 'string' && children.includes('```')) {
      // Split the string by the code block delimiters
      const parts = children.split('```');
      
      // The language is in the first part after the first delimiter
      const languageLine = parts[1].split('\n')[0].trim();
      const language = languageLine ? `language-${languageLine}` : '';

      // The content is the rest of the first part after the language line
      const codeContent = parts[1].split('\n').slice(1).join('\n').trim();

      codeProps.className = language;
      codeProps.children = codeContent;

      return components.code(codeProps);
    }
  }

  // Render a single [text](href) link through the anchor renderer so link
  // behaviour (external-navigation tracking) is testable.
  if (components && components.a && children && typeof children === 'string') {
    const link = children.match(/\[([^\]]+)\]\(([^)]+)\)/);

    if (link) {
      return (
        <div data-testid='react-markdown'>
          {components.a({ href: link[2], children: link[1] })}
        </div>
      );
    }
  }

  return (
    <div data-testid='react-markdown'>
      {children}
    </div>
  );
}

export default ReactMarkdown;
