import { z } from 'zod';

export const DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES = [
  // Text formats
  'text/plain', // .txt - Plain text (ASCII only)
  'text/markdown', // .md - Markdown
  'text/html', // .html - HyperText Markup Language
  // Word processing
  'application/msword', // .doc - Microsoft Word 97-2003
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx - Microsoft Word (modern)
  // Spreadsheets
  'text/csv', // .csv - Comma-separated values
  // 'application/vnd.ms-excel', // .xls - Microsoft Excel 97-2003
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx - Microsoft Excel (modern)
  // PDF
  'application/pdf', // .pdf - PDF
];
export const DOCUMENT_UPLOAD_INCOMPATIBLE_FILE_TYPE_ERROR =
  'Accepted file types: .txt, .md, .html, .doc, .docx, .csv, .xlsx, .pdf.';

// Allow no more than 5MB to be uploaded
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
      (file) => DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.includes(file.type)),
      DOCUMENT_UPLOAD_INCOMPATIBLE_FILE_TYPE_ERROR
    ),
});

export type AddDocument = z.infer<typeof addDocument>;

// Storage layer

export type S3DocumentUploadPayload = {
  key: string,
  body: string,
  contentType: string,
}

export type S3DocumentMetadata = {
  filePath: string;
  fileSize: number;
  dateUploaded: Date;
  fileType: string;
};

// Database layer

export type Document = {
  id: string;
  userId: string,
  filename: string;
  uploadStatus: DocumentUploadStatus;
  createdAt: Date;
}

export enum DocumentUploadStatus {
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
}

export const uploadStatusColorCode: Record<DocumentUploadStatus, string> = {
  [DocumentUploadStatus.Completed]: 'green',
  [DocumentUploadStatus.Pending]: 'yellow',
  [DocumentUploadStatus.Failed]: 'red',
};

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  filename: z.string(),
  createdAt: z.date(),
  uploadStatus: z.nativeEnum(DocumentUploadStatus),
});
