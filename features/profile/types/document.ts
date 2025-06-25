import { z } from 'zod';

export const ACCEPTED_FILE_TYPES = [
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export const MAX_FILE_SIZE_MB = 5;
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

export const addDocument = z.object({
  files: z.array(z.custom<File>())
    .min(1, 'At least one file is required')
    .refine((files) => files.every(
      (file) => file.size <= MAX_FILE_SIZE),
      `Files must be ${MAX_FILE_SIZE_MB} MB or less`
    )
    .refine((files) => files.every(
      (file) => ACCEPTED_FILE_TYPES.includes(file.type)),
      'Only .pdf, .docx, and .txt files are accepted'
    ),
});

export type UserDocument = {
  key: string,
  body: string,
  contentType: string,
}

export type AddDocument = z.infer<typeof addDocument>;

export type UserDocumentMetadata = {
  filePath: string;
  fileSize: number;
  dateUploaded: Date;
  fileType: string;
};
