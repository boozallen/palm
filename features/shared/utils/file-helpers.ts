interface FileParts {
    stem: string,
    extension: string
};

export const splitFileExtension = (filename: string): any => {
    // If there's no period in the filename, then the stem is the entire filename,
    // and the extension is an empty string:
    if (!filename.includes('.')) {
        return {
            stem: filename,
            extension: '',
        };
    }

    // Split up the filename around any periods that it contains:
    const filenameParts: string[] = filename.split('.');

    // Grab (and remove) the last period-delimited chunk of the filename...
    const endOfFilename: string | undefined = filenameParts.pop();

    // ...and joint the rest of the remaining chunks back together with periods
    // The stem is the latter (the remaining chunks re-joined), and
    // the extension is the last period-delimited chunk that we split off previously.
    let stem: string | undefined = filenameParts.join('.');
    let extension: string | undefined = endOfFilename;

    // Return both the stem and extension:
    return {
        stem: stem,
        extension: extension,
    };
};

export const lengthLimitedFilename = (filename: string, maxLength: number): string => {
    const { stem, extension } : FileParts = splitFileExtension(filename);

    if (stem.length <= maxLength) {
        return filename;
    }

    return `${stem.substring(0, maxLength)}...${extension}`;
};
