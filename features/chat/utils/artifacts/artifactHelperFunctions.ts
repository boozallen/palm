import { v4 } from 'uuid';
import { z } from 'zod';

import { Artifact } from '@/features/chat/types/message';
import { BINARY_FILE_EXTENSIONS } from '@/features/shared/types/document';
import { convertMarkdownToDocx } from './convertMarkdownToDocx';
import { convertMarkdownToExcel } from './convertMarkdownToXlsx';

const generatedArtifactSchema = z.object({
  content: z.string(),
  label: z.string(),
  fileExtension: z.string(),
  encoding: z.enum(['utf-8', 'base64']).optional(),
});

export const extractArtifactsFromMessage = (input: string): { artifacts: Artifact[], cleanedText: string } => {
  const artifacts: Artifact[] = [];
  let cleanedText = input;

  let match;
  // Third argument (encoding) is optional: ````artifact(".ext","label") or ````artifact(".ext","label","base64")
  const artifactPattern = /````artifact\("([^"]+)","([^"]+)"(?:,"([^"]+)")?\)\n\s*([\s\S]*?)\s*\n\s*````/g;
  while ((match = artifactPattern.exec(input)) !== null) {
    const [originalSubstring, rawExtension, label, encodingArg, content] = match;
    // Normalize: if the model outputs a full filename (e.g. "report.html") instead of
    // just the extension (e.g. ".html"), extract only the dot-prefixed extension part.
    const extMatch = rawExtension.match(/(\.[^.]+)$/);
    const fileExtension = extMatch ? extMatch[1] : rawExtension;
    const encoding = (encodingArg === 'base64' ? 'base64' : 'utf-8') as 'utf-8' | 'base64';
    const validation = generatedArtifactSchema.safeParse({
      fileExtension,
      label,
      content: content.trim(),
      encoding,
    });

    if (validation.success) {
      const artifact: Artifact = {
        ...validation.data,
        id: v4(),
        chatMessageId: '', // Overwrite once ChatMessage record is created
        githubPagesUrl: null,
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

// True when downloadArtifact will fetch from /api/chat/artifacts/download, which
// already audits server-side. Callers check this before recording client-side:
// both paths write DOWNLOAD_ARTIFACT, so skipping the check yields two
// indistinguishable rows.
export const isServerDownloadedArtifact = (artifact: Pick<Artifact, 'fileExtension' | 'content'>) =>
  BINARY_FILE_EXTENSIONS.includes(artifact.fileExtension.toLowerCase()) && !artifact.content;

export const downloadArtifact = async (artifact: Artifact) => {
  let blob: Blob;

  const isBinaryArtifact = isServerDownloadedArtifact(artifact);

  if (isBinaryArtifact) {
    const res = await fetch(`/api/chat/artifacts/download?id=${artifact.id}`);
    if (!res.ok) {
      throw new Error('Failed to download artifact');
    }
    blob = await res.blob();
  } else {
    switch (artifact.fileExtension) {
      case '.docx':
        try {
          blob = await convertMarkdownToDocx(artifact.content);
        } catch (error) {
          console.error('Failed to convert markdown to docx:', error);
          blob = new Blob([artifact.content], { type: 'text/plain' });
        }
        break;

      case '.xlsx':
        try {
          blob = await convertMarkdownToExcel(artifact.content);
        } catch (error) {
          console.error('Failed to convert markdown to xlsx:', error);
          blob = new Blob([artifact.content], { type: 'text/plain' });
        }
        break;

      case '.pptx':
        try {
          const { convertMarkdownToPptx } = await import('./convertMarkdownToPptx');
          blob = await convertMarkdownToPptx(artifact.content);
        } catch (error) {
          console.error('Failed to convert markdown to pptx:', error);
          blob = new Blob([artifact.content], { type: 'text/plain' });
        }
        break;

      default:
        blob = new Blob([artifact.content], { type: 'text/plain' });
        break;
    }
  }

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
    '.java': 'clike',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'clike',
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

export function formatArtifactLabel(filename: string): string {
  // Remove file extension
  const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '');

  // Convert kebab-case to Title Case
  return nameWithoutExtension
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
