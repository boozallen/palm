import {
  extractArtifactsFromMessage,
  addChatMessageIdToArtifacts,
  addArtifactInstructionsToMessage,
  downloadArtifact,
  formatAsRawText,
  formatAsMermaid,
  removeTrailingNewlines,
} from './artifactHelperFunctions';
import { Artifact } from '@/features/chat/types/message';

describe('artifactHelperFunctions', () => {
  describe('extractArtifactsFromMessage', () => {
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
  });

  describe('addChatMessageIdToArtifacts', () => {
    it('should add chatMessageId to each artifact', () => {
      const artifacts: Artifact[] = [
        { id: '1', fileExtension: '.js', label: 'JS Code', content: 'console.log();', chatMessageId: '', createdAt: new Date() },
        { id: '2', fileExtension: '.txt', label: 'Text', content: 'Hello', chatMessageId: '', createdAt: new Date() },
      ];
      const chatMessageId = 'chat123';

      const updatedArtifacts = addChatMessageIdToArtifacts(artifacts, chatMessageId);

      updatedArtifacts.forEach(artifact => {
        expect(artifact.chatMessageId).toBe(chatMessageId);
      });
    });
  });

  describe('addArtifactInstructionsToMessage', () => {
    it('should append artifact instructions to the input string', () => {
      const input = 'Initial system prompt';
      const result = addArtifactInstructionsToMessage(input);

      expect(result).toContain('Initial system prompt');
      expect(result).toContain('**Instructions**');
      expect(result).toContain('**Identify Artifact-Worthy Content**');
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
  
    it('should handle file extension with dot correctly', () => {
      const artifact: Artifact = {
        id: '1',
        fileExtension: '.txt',
        label: 'Test Artifact',
        content: 'This is a test artifact content.',
        chatMessageId: '123',
        createdAt: new Date(),
      };
  
      downloadArtifact(artifact);
  
      const aElement = document.createElement('a');
      expect(aElement.download).toBe('test-artifact.txt');
    });
  
    it('should use fileExtension as filename when it has no dot', () => {
      const artifact: Artifact = {
        id: '1',
        fileExtension: 'Dockerfile',
        label: 'Documentation',
        content: 'This is documentation content.',
        chatMessageId: '123',
        createdAt: new Date(),
      };
  
      downloadArtifact(artifact);
  
      const aElement = document.createElement('a');
      expect(aElement.download).toBe('Dockerfile');
    });
  
    it('should replace spaces in label with hyphens', () => {
      const artifact: Artifact = {
        id: '1',
        fileExtension: '.js',
        label: 'Complex JavaScript Code Example',
        content: 'console.log("Hello world");',
        chatMessageId: '123',
        createdAt: new Date(),
      };
  
      downloadArtifact(artifact);
  
      const aElement = document.createElement('a');
      expect(aElement.download).toBe('complex-javascript-code-example.js');
    });
  
    it('should convert label to lowercase when forming filename', () => {
      const artifact: Artifact = {
        id: '1',
        fileExtension: '.md',
        label: 'README File',
        content: '# README\nThis is a readme file.',
        chatMessageId: '123',
        createdAt: new Date(),
      };
  
      downloadArtifact(artifact);
  
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
});
