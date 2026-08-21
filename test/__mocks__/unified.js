// Mock implementation of unified for Jest tests
// This provides a simple markdown parser that returns a basic AST

function createSimpleAst(content) {
  const lines = content.split('\n');
  const children = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    // Heading
    if (line.match(/^(#{1,6})\s+(.+)/)) {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      children.push({
        type: 'heading',
        depth: match[1].length,
        children: [{ type: 'text', value: match[2] }],
      });
    }
    // Bullet list
    else if (line.match(/^[-*]\s+(.+)/)) {
      const match = line.match(/^[-*]\s+(.+)/);
      children.push({
        type: 'list',
        ordered: false,
        children: [{
          type: 'listItem',
          children: [{
            type: 'paragraph',
            children: parseInline(match[1]),
          }],
        }],
      });
    }
    // Numbered list
    else if (line.match(/^\d+\.\s+(.+)/)) {
      const match = line.match(/^\d+\.\s+(.+)/);
      children.push({
        type: 'list',
        ordered: true,
        children: [{
          type: 'listItem',
          children: [{
            type: 'paragraph',
            children: parseInline(match[1]),
          }],
        }],
      });
    }
    // Regular paragraph
    else {
      children.push({
        type: 'paragraph',
        children: parseInline(line),
      });
    }
  }

  return {
    type: 'root',
    children,
  };
}

function parseInline(text) {
  const children = [];

  // Simple regex for bold and italic
  const boldItalicRegex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
  let lastIndex = 0;

  let match;
  while ((match = boldItalicRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      children.push({
        type: 'text',
        value: text.substring(lastIndex, match.index),
      });
    }

    // Add formatted text
    if (match[1]) {
      // Bold
      children.push({
        type: 'strong',
        children: [{ type: 'text', value: match[2] }],
      });
    } else if (match[3]) {
      // Italic
      children.push({
        type: 'emphasis',
        children: [{ type: 'text', value: match[4] }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    children.push({
      type: 'text',
      value: text.substring(lastIndex),
    });
  }

  // If no formatting was found, return plain text
  if (children.length === 0) {
    return [{ type: 'text', value: text }];
  }

  return children;
}

const unified = () => {
  const processor = {
    use: () => processor,
    parse: (content) => createSimpleAst(content),
  };
  return processor;
};

module.exports = { unified };
