import { TextEncoder } from 'util';

import { convertFileToBase64 } from './fileHelpers';

describe('convertFileToBase64', () => {
  it('should convert a file to a base64 string', async () => {
    const fileContent = 'Hello, World!';
    const file = new File([fileContent], 'hello.txt', { type: 'text/plain' });

    // Mock the arrayBuffer method
    file.arrayBuffer = jest.fn().mockResolvedValue(new TextEncoder().encode(fileContent).buffer);

    const base64String = await convertFileToBase64(file);
    expect(base64String).toBe(Buffer.from(fileContent).toString('base64'));
  });

  it('should handle empty files correctly', async () => {
    const fileContent = '';
    const file = new File([fileContent], 'empty.txt', { type: 'text/plain' });

    // Mock the arrayBuffer method
    file.arrayBuffer = jest.fn().mockResolvedValue(new TextEncoder().encode(fileContent).buffer);

    const base64String = await convertFileToBase64(file);
    expect(base64String).toBe('');
  });

  it('should throw an error for invalid file input', async () => {
    await expect(convertFileToBase64(null as any)).rejects.toThrow();
  });
});
