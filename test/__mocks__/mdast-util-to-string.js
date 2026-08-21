// Mock for mdast-util-to-string
function toString(node) {
  if (!node) {
    return '';
  }

  if (node.value) {
    return node.value;
  }

  if (node.children) {
    return node.children.map(toString).join('');
  }

  return '';
}

module.exports = { toString };
