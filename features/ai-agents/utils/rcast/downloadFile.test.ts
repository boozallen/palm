import { downloadExportedFile } from './downloadFile';

describe('downloadExportedFile', () => {
  let mockLink: {
    href: string;
    download: string;
    click: jest.Mock;
  };
  let mockCreateObjectURL: jest.Mock;
  let mockRevokeObjectURL: jest.Mock;
  let mockAppendChild: jest.Mock;
  let mockRemoveChild: jest.Mock;

  beforeEach(() => {
    mockLink = {
      href: '',
      download: '',
      click: jest.fn(),
    };

    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    mockAppendChild = jest.fn();
    mockRemoveChild = jest.fn();
    jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
    jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

    mockCreateObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    mockRevokeObjectURL = jest.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should convert base64 data to blob and trigger download', () => {
    const base64Data = btoa('test file content');
    const filename = 'test.xlsx';
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    downloadExportedFile(base64Data, filename, mimeType);

    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);

    const blobArg = mockCreateObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe(mimeType);

    expect(mockLink.href).toBe('blob:mock-url');
    expect(mockLink.download).toBe(filename);

    expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should correctly decode base64 data', () => {
    const originalContent = 'Hello, World!';
    const base64Data = btoa(originalContent);

    downloadExportedFile(base64Data, 'hello.txt', 'text/plain');

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.size).toBe(originalContent.length);
  });

  it('should handle binary data correctly', () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 254, 253]);
    const base64Data = Buffer.from(bytes).toString('base64');

    downloadExportedFile(base64Data, 'binary.bin', 'application/octet-stream');

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.size).toBe(bytes.length);
    expect(blobArg.type).toBe('application/octet-stream');
  });

  it('should use correct MIME type for Excel files', () => {
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    downloadExportedFile(btoa('excel content'), 'report.xlsx', mimeType);

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe(mimeType);
  });

  it('should clean up resources in correct order', () => {
    const callOrder: string[] = [];
    mockAppendChild.mockImplementation(() => callOrder.push('appendChild'));
    mockLink.click.mockImplementation(() => callOrder.push('click'));
    mockRemoveChild.mockImplementation(() => callOrder.push('removeChild'));
    mockRevokeObjectURL.mockImplementation(() => callOrder.push('revokeObjectURL'));

    downloadExportedFile(btoa('test'), 'test.txt', 'text/plain');

    expect(callOrder).toEqual([
      'appendChild',
      'click',
      'removeChild',
      'revokeObjectURL',
    ]);
  });
});
