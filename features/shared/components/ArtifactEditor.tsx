import { useEffect, useState } from 'react';
import { Box, Button, Group, Textarea } from '@mantine/core';
import { IconDeviceFloppy, IconX } from '@tabler/icons-react';
import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';

import { usesRichTextEditor } from '@/features/shared/types/document';

type ArtifactEditorProps = {
  content: string;
  fileExtension: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

// Keeps a controlled textarea value in sync when the source artifact changes.
function useControlledContent(content: string): [string, (value: string) => void] {
  const [value, setValue] = useState(content);
  useEffect(() => {
    setValue(content);
  }, [content]);
  return [value, setValue];
}

// Rich text (Tiptap) editor for prose artifacts; round-trips content through Markdown so the saved value stays a plain-text-compatible string.
const RichArtifactEditor = ({ content, onSave, onCancel, isSaving }: Omit<ArtifactEditorProps, 'fileExtension'>) => {
  const [isDirty, setIsDirty] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start editing…' }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content,
    onUpdate: ({ editor: updatedEditor }) => {
      setIsDirty((updatedEditor.storage.markdown.getMarkdown() as string) !== content);
    },
  });

  // Reset editor contents when the incoming artifact changes (e.g. selecting a different artifact).
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(content);
    }
    setIsDirty(false);
    // Only re-run when the source content changes, not on every editor identity change.
  }, [content, editor]);

  const handleSave = () => {
    if (!editor) {
      return;
    }
    const markdown = editor.storage.markdown.getMarkdown() as string;
    onSave(markdown);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1, overflow: 'auto' }} p='md'>
        <RichTextEditor editor={editor}>
          <RichTextEditor.Toolbar sticky stickyOffset={0}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold />
              <RichTextEditor.Italic />
              <RichTextEditor.Underline />
              <RichTextEditor.Strikethrough />
              <RichTextEditor.ClearFormatting />
              <RichTextEditor.Code />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.H1 />
              <RichTextEditor.H2 />
              <RichTextEditor.H3 />
              <RichTextEditor.H4 />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Blockquote />
              <RichTextEditor.Hr />
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
              <RichTextEditor.CodeBlock />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Link />
              <RichTextEditor.Unlink />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.AlignLeft />
              <RichTextEditor.AlignCenter />
              <RichTextEditor.AlignRight />
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>

          <RichTextEditor.Content />
        </RichTextEditor>
      </Box>
      <EditorActions onSave={handleSave} onCancel={onCancel} isSaving={isSaving} saveDisabled={!editor || !isDirty} />
    </Box>
  );
};

// Plain-text editor for code and other non-prose text artifacts (html, json, csv, mermaid, ...).
const PlainArtifactEditor = ({ content, onSave, onCancel, isSaving }: Omit<ArtifactEditorProps, 'fileExtension'>) => {
  const [value, setValue] = useControlledContent(content);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1, overflow: 'auto' }} p='md'>
        <Textarea
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          autosize
          minRows={20}
          aria-label='Edit artifact content'
          styles={{ input: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
        />
      </Box>
      <EditorActions onSave={() => onSave(value)} onCancel={onCancel} isSaving={isSaving} saveDisabled={value === content} />
    </Box>
  );
};

const EditorActions = ({
  onSave,
  onCancel,
  isSaving,
  saveDisabled,
}: {
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  saveDisabled: boolean;
}) => (
  <Group position='right' spacing='xs' px='md' py='sm' bg='dark.6'>
    <Button variant='subtle' color='gray' leftIcon={<IconX size={16} />} onClick={onCancel} disabled={isSaving}>
      Cancel
    </Button>
    <Button
      leftIcon={<IconDeviceFloppy size={16} />}
      onClick={onSave}
      loading={isSaving}
      disabled={saveDisabled}
    >
      Save new version
    </Button>
  </Group>
);

const ArtifactEditor = ({ content, fileExtension, onSave, onCancel, isSaving }: ArtifactEditorProps) => {
  if (usesRichTextEditor(fileExtension)) {
    return <RichArtifactEditor content={content} onSave={onSave} onCancel={onCancel} isSaving={isSaving} />;
  }
  return <PlainArtifactEditor content={content} onSave={onSave} onCancel={onCancel} isSaving={isSaving} />;
};

export default ArtifactEditor;
