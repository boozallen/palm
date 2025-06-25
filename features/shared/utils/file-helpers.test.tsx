import { lengthLimitedFilename, splitFileExtension } from './file-helpers';

const FILENAME_CHAR = 'a';
const FILE_EXTENSION = 'txt';

const createFilename = (length: number): string => {
    return `${createStem(length)}.${FILE_EXTENSION}`;
};

const createStem = (length: number): string => {
    return FILENAME_CHAR.repeat(length);
};

describe('filename splits correctly', () => {
    it('should return the empty strings for stem and extension for an empty string', () => {
        const { stem, extension } = splitFileExtension('');
        expect(stem).toBe('');
        expect(extension).toBe('');
    });

  it('should return the entire filename if it doesn\'t contain an extension', () => {
    const { stem, extension } = splitFileExtension('Dockerfile');
    expect(stem).toBe('Dockerfile');
    expect(extension).toBe('');
  });

  it('should return the stem split from the extension with simple filename', () => {
    const { stem, extension } = splitFileExtension('foo.txt');
    expect(stem).toBe('foo');
    expect(extension).toBe('txt');    
  });  

  it('should return the stem split from the extension with complex filename', () => {
    const { stem, extension } = splitFileExtension('foo.bar.bat.baz.txt');
    expect(stem).toBe('foo.bar.bat.baz');
    expect(extension).toBe('txt');    
  });  
  
  it('should return the stem split from the extension with long filename', () => {
    const { stem, extension } = splitFileExtension('thisisaveryveryveryveryveryveryverylongfilenamesoveryveryveryverylong.txt');
    expect(stem).toBe('thisisaveryveryveryveryveryveryverylongfilenamesoveryveryveryverylong');
    expect(extension).toBe('txt');    
  });   
});

describe('filename truncated correctly', () => {
    it('should return an empty string if the filename is an empty string', () => {
        expect(lengthLimitedFilename('', 20)).toBe('');
    });

    it('should return a short filename as-is', () => {
        const length: number = 20;
        expect(lengthLimitedFilename(createFilename(length), length)).toBe(`${createStem(length)}.${FILE_EXTENSION}`);
    });    

    it('should return a one-char-too-long filename with one char trucated from the stem', () => {
        const length: number = 20;
        expect(lengthLimitedFilename(createFilename(length+1), length)).toBe(`${createStem(length)}...${FILE_EXTENSION}`);
    });  

    it('should return a very long filename with with the appropriate number of chars trucated from the stem', () => {
        const length: number = 20;
        expect(lengthLimitedFilename(createFilename(length+20), length)).toBe(`${createStem(length)}...${FILE_EXTENSION}`);
    });    

    it('should return a short extension-less filename as-is', () => {
        const length: number = 20;
        expect(lengthLimitedFilename(createStem(length), length)).toBe(`${createStem(length)}`);
    });    

    it('should return a one-char-too-long extension-less filename with one char trucated from the stem', () => {
        const length: number = 20;
        expect(lengthLimitedFilename(createStem(length+1), length)).toBe(`${createStem(length)}...`);
    });  

    it('should return a very long extension-less filename with with the appropriate number of chars trucated from the stem', () => {
        const length: number = 20;
        expect(lengthLimitedFilename(createStem(length+20), length)).toBe(`${createStem(length)}...`);
    });      
});
