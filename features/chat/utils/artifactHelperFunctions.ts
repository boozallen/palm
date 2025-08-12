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

export const addArtifactInstructionsToMessage = (input: string): string => {
  return `${input}
    **Instructions**
    1. **Identify Artifact-Worthy Content**:
      - The LLM should analyze its response to determine if there are any segments of text that qualify as 'artifact-worthy'. These are typically text, code snippets, configurations, or any structured data that could be reused or referenced independently.
      - Examples include standalone text documents, code in various programming languages, configuration files, or structured data like JSON or XML.
      - Artifacts are typically longer than 250 characters or 15+ lines of code.
      
    2. **Wrap the Content**:
      - For each segment identified as artifact-worthy, it should be wrapped in the following format:
        \`\`\`\`artifact("<file_extension>","<label>")
        <artifact_content>
        \`\`\`\`
      - Replace '<file_extension>' with the appropriate identifier for the content's file type (e.g., ".js" for JavaScript, ".php" for PHP, ".txt" for plain text). Do not make broad generalizations and be as specific as possible.
      - Provide a concise, sentence case '<label>' that describes the purpose or function of the artifact.
      - The 'artifact-worthy' '<artifact_content>' should be placed within the quadruple backticks. The artifact itself should not be wrapped in quadruple backticks.
      - Ensure that artifact-worthy content is only used once in the response, inside of this wrapped format. Never repeat artifact-worthy content outside of the artifact wrapping.

    3. **Handle Multiple Artifacts**:
      - If multiple artifact-worthy segments are present, each should be wrapped individually using the format described above.
      - Ensure that each artifact is clearly separated and independently wrapped.

    4. **Non-Artifact Content**:
      - If a response contains no artifact-worthy content, ensure that any existing backticks or code-like formatting are not mistakenly wrapped as artifacts.
      - Maintain the integrity of the original response structure, only applying the artifact wrapping where applicable.
      - Artifact-worthy content should only appear wrapped in backticks and the same artifact should not be repeated elsewhere in the response.
  `;
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
