import {
  extractArtifactsFromMessage,
  addChatMessageIdToArtifacts,
  downloadArtifact,
  formatAsRawText,
  formatAsMermaid,
  removeTrailingNewlines,
  getMantinePrismLanguage,
  formatArtifactLabel,
  canOpenArtifactInViewer,
  getArtifactPreviewFlags,
} from './artifactHelperFunctions';
import { Artifact } from '@/features/chat/types/message';

describe('artifactHelperFunctions', () => {
  describe('canOpenArtifactInViewer', () => {
    const artifact: Artifact = {
      id: 'artifact-1',
      fileExtension: '.txt',
      label: 'Artifact',
      content: '',
      chatMessageId: 'message-1',
      githubPagesUrl: null,
      githubUrl: null,
      createdAt: new Date(),
    };

    it('opens text artifacts and binary artifacts with inline content', () => {
      expect(canOpenArtifactInViewer(artifact)).toBe(true);
      expect(canOpenArtifactInViewer({
        ...artifact,
        fileExtension: '.pdf',
        content: 'Inline content',
      })).toBe(true);
    });

    it('does not open download-only binary artifacts', () => {
      expect(canOpenArtifactInViewer({
        ...artifact,
        fileExtension: '.pdf',
      })).toBe(false);
    });

    it.each(['.docx', '.xlsx', '.pptx'])(
      'opens previewable empty %s artifacts without a GitHub URL',
      (fileExtension) => {
        expect(canOpenArtifactInViewer({
          ...artifact,
          fileExtension,
        })).toBe(true);
      },
    );

    it.each(['.docx', '.xlsx', '.pptx'])(
      'does not open empty %s artifacts backed by a GitHub URL',
      (fileExtension) => {
        expect(canOpenArtifactInViewer({
          ...artifact,
          fileExtension,
          githubUrl: 'https://github.example/artifact',
        })).toBe(false);
      },
    );

    it('compares the extension without regard to case', () => {
      expect(canOpenArtifactInViewer({ ...artifact, fileExtension: '.DOCX' })).toBe(true);
      expect(canOpenArtifactInViewer({ ...artifact, fileExtension: '.PDF' })).toBe(false);
    });
  });

  describe('getArtifactPreviewFlags', () => {
    it('resolves the preview type from an upper-case extension', () => {
      expect(getArtifactPreviewFlags({ fileExtension: '.DOCX', content: '', githubUrl: null })).toEqual({
        fileExtension: '.docx',
        isPreviewableDocx: true,
        isPreviewableXlsx: false,
        isPreviewablePptx: false,
        isPreviewableCsv: false,
        isPreviewableMp4: false,
        isBinaryNoPreview: false,
      });
    });

    it('marks a binary artifact with no preview as download-only', () => {
      expect(getArtifactPreviewFlags({ fileExtension: '.pdf', content: '', githubUrl: null }).isBinaryNoPreview).toBe(true);
    });

    it('does not preview an empty document backed by a GitHub URL', () => {
      const flags = getArtifactPreviewFlags({ fileExtension: '.docx', content: '', githubUrl: 'https://github.example/artifact' });
      expect(flags.isPreviewableDocx).toBe(false);
      expect(flags.isBinaryNoPreview).toBe(true);
    });

    it('previews an mp4 when it has inline content', () => {
      const withContent = getArtifactPreviewFlags({ fileExtension: '.mp4', content: 'data', githubUrl: null });
      expect(withContent.isPreviewableMp4).toBe(true);
      expect(withContent.isBinaryNoPreview).toBe(false);

      const withoutContent = getArtifactPreviewFlags({ fileExtension: '.mp4', content: '', githubUrl: null });
      expect(withoutContent.isPreviewableMp4).toBe(false);
      expect(withoutContent.isBinaryNoPreview).toBe(true);
    });

    it('previews a csv only when it has inline content', () => {
      expect(getArtifactPreviewFlags({ fileExtension: '.csv', content: 'a,b', githubUrl: null }).isPreviewableCsv).toBe(true);
      expect(getArtifactPreviewFlags({ fileExtension: '.csv', content: '', githubUrl: null }).isPreviewableCsv).toBe(false);
    });
  });

  describe('extractArtifactsFromMessage', () => {
    it('stores the extension in lower case whatever the model wrote', () => {
      const { artifacts } = extractArtifactsFromMessage('````artifact(".MD","Notes")\nhello\n````');

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].fileExtension).toBe('.md');
    });

    it('should successfully extract valid artifacts from input', () => {
      const input = `Here is some text
      \`\`\`\`artifact(".js","JavaScript Code")\n
      console.log("Hello, world!");
      \`\`\`\`
      and some more text.`;

      const { artifacts, cleanedText } = extractArtifactsFromMessage(input);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toMatchObject({
        fileExtension: '.js',
        label: 'JavaScript Code',
        content: 'console.log("Hello, world!");',
      });
      expect(cleanedText).toBe('Here is some text\n      \n      and some more text.');
    });

    it('should only extract valid artifacts', () => {
      const input = `Some text
      \`\`\`\`artifact(".txt","Text File")\n
      This is a text file content.
      \`\`\`\`
      More text
      \`\`\`\`artifact(".md","Markdown File")\n
      # This is a markdown file
      \`\`\`\`
      End of text.`;

      const { artifacts, cleanedText } = extractArtifactsFromMessage(input);

      expect(artifacts).toHaveLength(2);
      expect(artifacts[0]).toMatchObject({
        fileExtension: '.txt',
        label: 'Text File',
        content: 'This is a text file content.',
      });
      expect(artifacts[1]).toMatchObject({
        fileExtension: '.md',
        label: 'Markdown File',
        content: '# This is a markdown file',
      });
      expect(cleanedText).toBe('Some text\n      \n      More text\n      \n      End of text.');
    });

    it('should not extract triple backtick markdown content or invalid artifacts from input', () => {
      const input = `Some text before
      \`\`\`javascript
      console.log('print example')
      \`\`\`
      some more text
      \`\`\`\`artifact(".js","JavaScript Code")
      console.log('Hello, world!') // Missing closing backticks`;

      const { artifacts, cleanedText } = extractArtifactsFromMessage(input);

      expect(artifacts).toHaveLength(0);
      expect(cleanedText).toBe(input);
    });

    it('should return empty artifacts array and original text when no artifacts are present', () => {
      const input = 'Some text without artifacts';
      const { artifacts, cleanedText } = extractArtifactsFromMessage(input);

      expect(artifacts).toHaveLength(0);
      expect(cleanedText).toBe(input);
    });

    it('should normalize full filename to extension only', () => {
      const input = `Here is an artifact
      \`\`\`\`artifact("report.html","HTML Report")\n
      <h1>Report</h1>
      \`\`\`\``;

      const { artifacts } = extractArtifactsFromMessage(input);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].fileExtension).toBe('.html');
      expect(artifacts[0].label).toBe('HTML Report');
    });

    it('should handle extension without dot by keeping it as-is when no dot is found', () => {
      const input = `Here is a dockerfile
      \`\`\`\`artifact("Dockerfile","Docker Configuration")\n
      FROM node:18
      \`\`\`\``;

      const { artifacts } = extractArtifactsFromMessage(input);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].fileExtension).toBe('Dockerfile');
      expect(artifacts[0].label).toBe('Docker Configuration');
    });

    it('should extract extension from complex filename with multiple dots', () => {
      const input = `Multiple dots test
      \`\`\`\`artifact("my.app.config.json","Configuration")\n
      {"key": "value"}
      \`\`\`\``;

      const { artifacts } = extractArtifactsFromMessage(input);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].fileExtension).toBe('.json');
    });
  });

  describe('addChatMessageIdToArtifacts', () => {
    it('should add chatMessageId to each artifact', () => {
      const artifacts: Artifact[] = [
        { id: '1', fileExtension: '.js', label: 'JS Code', content: 'console.log();', chatMessageId: '', githubPagesUrl: null, createdAt: new Date() },
        { id: '2', fileExtension: '.txt', label: 'Text', content: 'Hello', chatMessageId: '', githubPagesUrl: null, createdAt: new Date() },
      ];
      const chatMessageId = 'chat123';

      const updatedArtifacts = addChatMessageIdToArtifacts(artifacts, chatMessageId);

      updatedArtifacts.forEach(artifact => {
        expect(artifact.chatMessageId).toBe(chatMessageId);
      });
    });
  });

  describe('downloadArtifact', () => {
    // Mock setup
    beforeEach(() => {
      // Mock URL methods
      global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/some-blob-url');
      global.URL.revokeObjectURL = jest.fn();

      // Mock document.createElement to return a mock anchor element
      const mockAnchorElement = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      document.createElement = jest.fn(() => mockAnchorElement) as jest.Mock;

      // Mock DOM methods
      jest.spyOn(document.body, 'appendChild').mockImplementation(jest.fn());
      jest.spyOn(document.body, 'removeChild').mockImplementation(jest.fn());
    });

    it('should handle file extension with dot correctly', async () => {
      const artifact: Artifact = {
        id: '1',
        fileExtension: '.txt',
        label: 'Test Artifact',
        content: 'This is a test artifact content.',
        chatMessageId: '123',
        githubPagesUrl: null,
        createdAt: new Date(),
      };

      await downloadArtifact(artifact);

      const aElement = document.createElement('a');
      expect(aElement.download).toBe('test-artifact.txt');
    });

    it('should use fileExtension as filename when it has no dot', async () => {
      const artifact: Artifact = {
        id: '1',
        fileExtension: 'Dockerfile',
        label: 'Documentation',
        content: 'This is documentation content.',
        chatMessageId: '123',
        githubPagesUrl: null,
        createdAt: new Date(),
      };

      await downloadArtifact(artifact);

      const aElement = document.createElement('a');
      expect(aElement.download).toBe('Dockerfile');
    });

    it('should replace spaces in label with hyphens', async () => {
      const artifact: Artifact = {
        id: '1',
        fileExtension: '.js',
        label: 'Complex JavaScript Code Example',
        content: 'console.log("Hello world");',
        chatMessageId: '123',
        githubPagesUrl: null,
        createdAt: new Date(),
      };

      await downloadArtifact(artifact);

      const aElement = document.createElement('a');
      expect(aElement.download).toBe('complex-javascript-code-example.js');
    });

    it('should convert label to lowercase when forming filename', async () => {
      const artifact: Artifact = {
        id: '1',
        fileExtension: '.md',
        label: 'README File',
        content: '# README\nThis is a readme file.',
        chatMessageId: '123',
        githubPagesUrl: null,
        createdAt: new Date(),
      };

      await downloadArtifact(artifact);

      const aElement = document.createElement('a');
      expect(aElement.download).toBe('readme-file.md');
    });
  });

  describe('formatAsRawText', () => {
    it('should format content as raw text with the specified file extension', () => {
      const content = 'console.log(\'Hello, world!\');\nfunction test() {\n  return true;\n}';
      const fileExtension = '.js';

      const formattedText = formatAsRawText(content, fileExtension);

      expect(formattedText).toBe(
        '```js\nconsole.log(\'Hello, world!\');\nfunction test() {\n  return true;\n}\n```'
      );
    });

    it('should replace triple backticks in content with modified version', () => {
      const content = 'function example() {\n  console.log(```);\n}';
      const fileExtension = '.js';

      const formattedText = formatAsRawText(content, fileExtension);

      expect(formattedText).toBe(
        '```js\nfunction example() {\n  console.log(`\u200B`\u200B`);\n}\n```'
      );
    });

    it('should handle empty content correctly', () => {
      const content = '';
      const fileExtension = '.txt';

      const formattedText = formatAsRawText(content, fileExtension);

      expect(formattedText).toBe('```txt\n\n```');
    });
  });

  describe('formatAsMermaid', () => {
    it('should wrap content in mermaid pre tags', () => {
      const content = 'graph TD;\nCEO-->CTO;';
      const formattedContent = formatAsMermaid(content);

      expect(formattedContent).toBe('<pre class="mermaid">\ngraph TD;\nCEO-->CTO;\n</pre>');
    });

    it('should handle empty content correctly', () => {
      const content = '';

      const formattedContent = formatAsMermaid(content);

      expect(formattedContent).toBe('<pre class="mermaid">\n\n</pre>');
    });

    it('should preserve complex corporate org chart', () => {
      const content = `graph TD
        CEO[CEO] --> COO[Chief Operations Officer]
        CEO --> CTO[Chief Technology Officer]
        CEO --> CFO[Chief Financial Officer]
        CTO --> VP_Eng[VP of Engineering]
        CTO --> VP_Product[VP of Product]
        VP_Eng --> FE_Lead[Frontend Lead]
        VP_Eng --> BE_Lead[Backend Lead]
        VP_Eng --> QA_Lead[QA Lead]
        VP_Product --> PM[Product Managers]
        VP_Product --> UX[UX Designers]
        COO --> HR[HR Director]
        COO --> Marketing[Marketing Director]
        CFO --> Finance[Finance Team]
        CFO --> Accounting[Accounting Team]`;

      const formattedContent = formatAsMermaid(content);

      expect(formattedContent).toBe(`<pre class="mermaid">\n${content}\n</pre>`);
    });
  });

  describe('removeTrailingNewlines', () => {
    it('should remove a single trailing newline', () => {
      const content = 'This is a line with a newline\n';
      const result = removeTrailingNewlines(content);
      expect(result).toBe('This is a line with a newline');
    });

    it('should not alter content without trailing newline', () => {
      const content = 'This is a line without a newline';
      const result = removeTrailingNewlines(content);
      expect(result).toBe(content);
    });

    it('should handle empty content correctly', () => {
      const content = '';
      const result = removeTrailingNewlines(content);
      expect(result).toBe('');
    });

    it('should remove multiple trailing newlines', () => {
      const content = 'This is a line with multiple newlines\n\n\n';
      const result = removeTrailingNewlines(content);
      expect(result).toBe('This is a line with multiple newlines\n\n');
    });
  });

  describe('getMantinePrismLanguage', () => {
    it('should return correct language for JavaScript file extensions', () => {
      expect(getMantinePrismLanguage('.js')).toBe('javascript');
      expect(getMantinePrismLanguage('.jsx')).toBe('jsx');
    });

    it('should return correct language for TypeScript file extensions', () => {
      expect(getMantinePrismLanguage('.ts')).toBe('typescript');
      expect(getMantinePrismLanguage('.tsx')).toBe('tsx');
    });

    it('should return correct language for common programming languages', () => {
      expect(getMantinePrismLanguage('.py')).toBe('python');
      expect(getMantinePrismLanguage('.java')).toBe('clike');
      expect(getMantinePrismLanguage('.c')).toBe('c');
      expect(getMantinePrismLanguage('.cpp')).toBe('cpp');
      expect(getMantinePrismLanguage('.cs')).toBe('csharp');
      expect(getMantinePrismLanguage('.php')).toBe('clike');
      expect(getMantinePrismLanguage('.rb')).toBe('ruby');
      expect(getMantinePrismLanguage('.go')).toBe('go');
      expect(getMantinePrismLanguage('.rs')).toBe('rust');
    });

    it('should return correct language for shell scripts', () => {
      expect(getMantinePrismLanguage('.sh')).toBe('bash');
      expect(getMantinePrismLanguage('.bash')).toBe('bash');
    });

    it('should return correct language for styling languages', () => {
      expect(getMantinePrismLanguage('.css')).toBe('css');
      expect(getMantinePrismLanguage('.scss')).toBe('scss');
      expect(getMantinePrismLanguage('.sass')).toBe('sass');
      expect(getMantinePrismLanguage('.less')).toBe('less');
    });

    it('should return correct language for markup languages', () => {
      expect(getMantinePrismLanguage('.html')).toBe('markup');
      expect(getMantinePrismLanguage('.xml')).toBe('markup');
      expect(getMantinePrismLanguage('.md')).toBe('markdown');
    });

    it('should return correct language for data formats', () => {
      expect(getMantinePrismLanguage('.json')).toBe('json');
      expect(getMantinePrismLanguage('.yaml')).toBe('yaml');
      expect(getMantinePrismLanguage('.yml')).toBe('yaml');
      expect(getMantinePrismLanguage('.sql')).toBe('sql');
    });

    it('should return correct language for special file types', () => {
      expect(getMantinePrismLanguage('.mmd')).toBe('yaml');
      expect(getMantinePrismLanguage('.mermaid')).toBe('yaml');
      expect(getMantinePrismLanguage('.dockerfile')).toBe('graphql');
      expect(getMantinePrismLanguage('.makefile')).toBe('makefile');
      expect(getMantinePrismLanguage('.diff')).toBe('diff');
      expect(getMantinePrismLanguage('.patch')).toBe('diff');
      expect(getMantinePrismLanguage('.graphql')).toBe('graphql');
    });

    it('should return correct language for modern languages', () => {
      expect(getMantinePrismLanguage('.kt')).toBe('kotlin');
      expect(getMantinePrismLanguage('.swift')).toBe('swift');
      expect(getMantinePrismLanguage('.dart')).toBe('dart');
      expect(getMantinePrismLanguage('.r')).toBe('r');
    });

    it('should handle case insensitive file extensions', () => {
      expect(getMantinePrismLanguage('.JS')).toBe('javascript');
      expect(getMantinePrismLanguage('.PY')).toBe('python');
      expect(getMantinePrismLanguage('.HTML')).toBe('markup');
    });

    it('should return default "clike" for unknown file extensions', () => {
      expect(getMantinePrismLanguage('.unknown')).toBe('clike');
      expect(getMantinePrismLanguage('.xyz')).toBe('clike');
      expect(getMantinePrismLanguage('')).toBe('clike');
    });

    it('should handle file extensions with mixed case', () => {
      expect(getMantinePrismLanguage('.Js')).toBe('javascript');
      expect(getMantinePrismLanguage('.CSS')).toBe('css');
      expect(getMantinePrismLanguage('.Py')).toBe('python');
    });
  });

  describe('formatArtifactLabel', () => {
    it('should convert kebab-case to Title Case', () => {
      expect(formatArtifactLabel('my-component.tsx')).toBe('My Component');
      expect(formatArtifactLabel('user-profile.js')).toBe('User Profile');
      expect(formatArtifactLabel('api-handler.ts')).toBe('Api Handler');
    });

    it('should remove file extension', () => {
      expect(formatArtifactLabel('document.pdf')).toBe('Document');
      expect(formatArtifactLabel('image.png')).toBe('Image');
      expect(formatArtifactLabel('data.json')).toBe('Data');
    });

    it('should handle single word filenames', () => {
      expect(formatArtifactLabel('readme.md')).toBe('Readme');
      expect(formatArtifactLabel('dockerfile')).toBe('Dockerfile');
      expect(formatArtifactLabel('config.yaml')).toBe('Config');
    });

    it('should handle multiple dashes', () => {
      expect(formatArtifactLabel('my-long-file-name.txt')).toBe('My Long File Name');
      expect(formatArtifactLabel('super-important-config-file.json')).toBe('Super Important Config File');
    });

    it('should handle filenames without extension', () => {
      expect(formatArtifactLabel('dockerfile')).toBe('Dockerfile');
      expect(formatArtifactLabel('my-script')).toBe('My Script');
    });

    it('should handle multiple extensions', () => {
      expect(formatArtifactLabel('app.config.json')).toBe('App.config');
      expect(formatArtifactLabel('test.spec.ts')).toBe('Test.spec');
    });

    it('should handle empty string', () => {
      expect(formatArtifactLabel('')).toBe('');
    });

    it('should capitalize first letter of each word', () => {
      expect(formatArtifactLabel('api-endpoint-handler.js')).toBe('Api Endpoint Handler');
      expect(formatArtifactLabel('user-authentication-service.ts')).toBe('User Authentication Service');
    });
  });
});
