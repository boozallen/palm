import { v4 } from 'uuid';
import { z } from 'zod';

import { Artifact } from '@/features/chat/types/message';

const generatedArtifactSchema = z.object({
  content: z.string(),
  label: z.string(),
  fileExtension: z.string(),
});

export const extractArtifactsFromMessage = (input: string): { artifacts: Artifact[], cleanedText: string } => {
  const artifacts: Artifact[] = [];
  let cleanedText = input;

  let match;
  const artifactPattern = /````artifact\("([^"]+)","([^"]+)"\)\n\s*([\s\S]*?)\s*\n\s*````/g;
  while ((match = artifactPattern.exec(input)) !== null) {
    const [originalSubstring, fileExtension, label, content] = match;
    const validation = generatedArtifactSchema.safeParse({
      fileExtension,
      label,
      content: content.trim(),
    });

    if (validation.success) {
      const artifact: Artifact = {
        ...validation.data,
        id: v4(),
        chatMessageId: '', // Overwrite once ChatMessage record is created
        createdAt: new Date(),
      };

      artifacts.push(artifact);
      cleanedText = cleanedText.replace(originalSubstring, '');
    }
  }

  return { artifacts, cleanedText };
};

export const addChatMessageIdToArtifacts = (artifacts: Artifact[], chatMessageId: string) => {
  artifacts.forEach(async (artifact) => {
    artifact.chatMessageId = chatMessageId;
  });
  return artifacts;
};

export const downloadArtifact = (artifact: Artifact) => {
  const blob = new Blob([artifact.content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  let filename = artifact.fileExtension.includes('.') ?
    `${artifact.label.toLowerCase().replaceAll(' ', '-')}${artifact.fileExtension}`
  :
    artifact.fileExtension;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const formatAsRawText = (content: string, fileExtension: string): string => {
  const codeBlockContent = content.replace(/```/g, '`\u200B`\u200B`');
  return `\`\`\`${fileExtension.slice(1)}\n${codeBlockContent}\n\`\`\``;
};

export const formatAsMermaid = (content: string): string => {
  return `<pre class="mermaid">\n${content}\n</pre>`;
};

export const removeTrailingNewlines = (content: string): string => {
  return content.replace(/\n$/, '');
};

export const getMantinePrismLanguage = (fileExtension: string): string => {
  const extensionMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.sh': 'bash',
    '.bash': 'bash',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.html': 'markup',
    '.xml': 'markup',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.sql': 'sql',
    '.md': 'markdown',
    '.mmd': 'yaml',
    '.mermaid': 'yaml',
    '.dockerfile': 'graphql',
    '.makefile': 'makefile',
    '.diff': 'diff',
    '.patch': 'diff',
    '.graphql': 'graphql',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.dart': 'dart',
    '.r': 'r',
  };

  return extensionMap[fileExtension.toLowerCase()] || 'clike';
};
