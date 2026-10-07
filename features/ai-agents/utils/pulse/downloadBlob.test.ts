import downloadBlob from '@/features/ai-agents/utils/pulse/downloadBlob';

describe('downloadBlob', () => {
  const createObjectURL = jest.fn(() => 'blob:matrix');
  const revokeObjectURL = jest.fn();

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('downloads the blob under the given file name', () => {
    const click = jest.fn();
    const anchor = document.createElement('a');

    anchor.click = click;
    jest.spyOn(document, 'createElement').mockReturnValueOnce(anchor);

    downloadBlob(new Blob(['x']), 'prompt-matrix.xlsx');

    expect(anchor.download).toBe('prompt-matrix.xlsx');
    expect(anchor.href).toContain('blob:matrix');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('releases the object URL and removes the anchor', () => {
    jest.useFakeTimers();

    const anchor = document.createElement('a');

    anchor.click = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValueOnce(anchor);

    downloadBlob(new Blob(['x']), 'prompt-matrix.xlsx');

    expect(document.body.contains(anchor)).toBe(false);

    jest.runAllTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:matrix');
    jest.useRealTimers();
  });

  it('leaves the object URL alive until the browser has had a chance to read it', () => {
    jest.useFakeTimers();

    const anchor = document.createElement('a');

    anchor.click = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValueOnce(anchor);

    downloadBlob(new Blob(['x']), 'prompt-matrix.xlsx');

    expect(revokeObjectURL).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
