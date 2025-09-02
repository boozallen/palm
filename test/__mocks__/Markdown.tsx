import React from 'react';

type MarkdownProps = {
  value: string;
  fileExtension?: string;
  isPreview?: boolean;
};

const MockMarkdown: React.FC<MarkdownProps> = ({ value, fileExtension, isPreview }) => {
  return (
    <div data-testid='markdown-content'>
      <div>Value: {value}</div>
      <div>File Extension: {fileExtension}</div>
      <div>Is Preview: {isPreview ? 'true' : 'false'}</div>
    </div>
  );
};

export default MockMarkdown;
