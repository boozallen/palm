import { z } from 'zod';

const AUDIO_FILE_MIME_TYPES = [
  'audio/mpeg', // .mp3 - MP3 audio
  'audio/mp3', // .mp3 - MP3 audio (alternative MIME type)
  'audio/m4a', // .m4a - M4A audio
  'audio/mp4', // .m4a - M4A audio (alternative MIME type)
  'audio/x-m4a', // .m4a - M4A audio (alternative MIME type)
  'audio/wav', // .wav - WAV audio
  'audio/x-wav', // .wav - WAV audio (alternative MIME type)
  'audio/wave', // .wav - WAV audio (alternative MIME type)
];

const MICROSOFT_FILE_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx - Microsoft Word (modern)
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx - Microsoft PowerPoint (modern)
  'application/vnd.openxmlformats-officedocument.presentationml.template', // .potx - Microsoft PowerPoint Template
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx - Microsoft Excel (modern)
  // 'application/vnd.ms-excel', // .xls - Microsoft Excel 97-2003
];

export const DOCUMENT_UPLOAD_ACCEPTED_FILE_MIME_TYPES = [
  // Text formats
  'text/plain', // .txt - Plain text (ASCII only)
  'text/markdown', // .md - Markdown
  'text/x-markdown', // .md - Markdown (alternative MIME type)
  'text/html', // .html - HyperText Markup Language
  'text/csv', // .csv - Comma-separated values
  // PDF
  'application/pdf', // .pdf - PDF
  // JSON
  'application/json', // .json - JSON
  // Microsoft Office
  ...MICROSOFT_FILE_MIME_TYPES,
  // Audio
  ...AUDIO_FILE_MIME_TYPES,
];

export const AUDIO_FILE_TYPES = ['.mp3', '.m4a', '.wav'];

export const MICROSOFT_FILE_TYPES = ['.docx', '.pptx', '.potx', '.xlsx' /* .xls */];

export const DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES = [
  '.txt', '.md', '.html', '.csv', '.pdf', '.json', ...MICROSOFT_FILE_TYPES, ...AUDIO_FILE_TYPES,
];

// Extension for a filename, matched against the known accepted types first so
// e.g. '.tar.gz' style names resolve to a stable bucket rather than '.gz'.
// Falls back to whatever follows the last '.' for anything else.
export const getFileExtension = (filename: string): string => {
  const lower = filename.toLowerCase();
  const match = DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.find((ext) => lower.endsWith(ext));
  return match ?? ('.' + (lower.split('.').pop() ?? 'unknown'));
};

export const PREVIEW_AS_RENDERED_FILE_TYPES = [
  '.md',
  '.mmd',
  '.mermaid',
  '.html',
];

export const WORKFLOW_ARTIFACT_FILE_TYPES = ['.json', '.md', '.mmd', '.html', '.csv', '.xlsx', '.docx', '.pptx', '.mp4', '.txt'] as const;
export type WorkflowArtifactFileType = typeof WORKFLOW_ARTIFACT_FILE_TYPES[number];

// Binary file extensions that contain null bytes and cannot be stored in text column
export const BINARY_FILE_EXTENSIONS = ['.docx', '.xlsx', '.pptx', '.pdf', '.zip', '.tar', '.gz', '.mp4'];

// Prose artifacts edited with the Mantine rich text (Tiptap) editor via Markdown round-tripping.
export const RICH_TEXT_EDITABLE_FILE_TYPES = ['.md', '.txt'];

// True for any non-binary artifact with content; editor type (rich text vs plain-text) is decided separately.
export const isEditableArtifact = (fileExtension: string, content: string): boolean => {
  if (BINARY_FILE_EXTENSIONS.includes(fileExtension.toLowerCase())) {
    return false;
  }
  return content.length > 0;
};

export const usesRichTextEditor = (fileExtension: string): boolean =>
  RICH_TEXT_EDITABLE_FILE_TYPES.includes(fileExtension.toLowerCase());

// MIME type mapping for tabular/spreadsheet data formats
export const TABULAR_FILE_MAP: Record<string, string> = {
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
};
export const TABULAR_FILE_EXTENSIONS = Object.keys(TABULAR_FILE_MAP);
export const TABULAR_DATA_MIME_TYPES = Object.values(TABULAR_FILE_MAP);

// MIME type mapping for binary file downloads
export const BINARY_FILE_DOWNLOAD_MAP: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
};

// Base artifact structure shared between chat artifacts and workflow artifacts.
export type BaseArtifact = {
  id: string;
  fileExtension: string;
  label: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
  githubPagesUrl: string | null;
  githubUrl?: string | null;
  createdAt: Date;
  sourceScript?: string | null;
};

export const DOCUMENT_UPLOAD_INCOMPATIBLE_FILE_TYPE_ERROR =
  `Accepted file types: ${DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.join(',')}.`;

// Allow no more than 100MB to be uploaded
export const MAX_FILE_SIZE_MB = 100;
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

// Maximum number of documents a user can have in their library
export const DOCUMENT_LIBRARY_DOCUMENT_LIMIT = 200;

const isAudioFile = (fileName: string): boolean => {
  const lowerCaseFileName = fileName.toLowerCase();
  return AUDIO_FILE_TYPES.some((ext) => lowerCaseFileName.endsWith(ext));
};

const isAcceptedFileType = (file: File): boolean => {
  // Check MIME type first
  if (DOCUMENT_UPLOAD_ACCEPTED_FILE_MIME_TYPES.includes(file.type)) {
    return true;
  }

  // Fallback: handle cases where browsers assign unexpected MIME types
  const fileName = file.name.toLowerCase();

  // Handle .md files
  if (fileName.endsWith('.md') && (file.type === '' || file.type === 'application/octet-stream' || file.type === 'text/plain')) {
    return true;
  }

  // Handle audio files
  if (isAudioFile(fileName) && (file.type === '' || file.type === 'application/octet-stream')) {
    return true;
  }

  // Handle MS Office files
  if (MICROSOFT_FILE_TYPES.some(ext => fileName.endsWith(ext)) &&
      (file.type === '' || file.type === 'application/octet-stream')) {
    return true;
  }

  return false;
};

export const addDocument = z.object({
  files: z.array(z.custom<File>())
    .min(1, 'At least one file is required')
    .refine((files) => files.every(
      (file) => file.size <= MAX_FILE_SIZE),
      `Files must be ${MAX_FILE_SIZE_MB} MB or less`
    )
    .refine((files) => files.every(isAcceptedFileType),
      DOCUMENT_UPLOAD_INCOMPATIBLE_FILE_TYPE_ERROR
    ),
});

export type AddDocument = z.infer<typeof addDocument>;

// Cloud Storage layer

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

// Unified metadata container for all document types.
export type DataProfile = {
  // General metadata (all file types)
  summary?: string;
  date?: string; // ISO date string (YYYY-MM-DD) - (e.g.,the document's publication date)
  type?: string; // document type

  // Structured data metadata (Excel/CSV only)
  sheets?: {
    [sheetName: string]: {
      rowCount: number;
      columns: Array<{
        name: string;
        dtype: string;
        uniqueValues?: unknown[];
        min?: number;
        max?: number;
      }>;
    };
  };
};

export type Document = {
  id: string;
  userId: string,
  filename: string;
  uploadStatus: DocumentUploadStatus;
  createdAt: Date;
  text?: string;
  adminCreated: boolean;
  dataProfile?: DataProfile | null;
  assignedGroupIds?: string[];
  assignedGroupLabels?: string[];
  collections?: Array<{
    id: string;
    name: string;
    color: string | null;
    shared?: boolean;
    ownerId?: string;
    ownerName?: string;
  }>;
}

export type DocumentLineageNode = {
  userId: string;
  userName: string;
  userEmail?: string;
  userGroupIds?: string[];
};

export type DocumentLineage = {
  depth: number;
  chain: DocumentLineageNode[];
};

export type GraphJobInfo = {
  status: 'Pending' | 'Building' | 'Resolving' | 'Completed' | 'Failed';
  jobId?: string;
  progress?: {
    totalChunks?: number;
    processedChunks?: number;
    currentStep?: string;
  };
  completedAt?: Date;
  errorMessage?: string;
};

export type ShareStatusCounts = {
  pending: number;
  accepted: number;
  rejected: number;
};

export type AdminDocument = Document & {
  assignedGroupIds: string[];
  userName: string;
  userEmail?: string;
  userGroupMemberships: Array<{ id: string; label: string }>;
  lineage?: DocumentLineage;
  graphJobInfo?: GraphJobInfo;
  shareStatusCounts?: ShareStatusCounts;
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

const DataProfileSchema = z.object({
  summary: z.string().optional(),
  date: z.string().optional(),
  type: z.string().optional(),
  sheets: z.record(z.object({
    rowCount: z.number(),
    columns: z.array(z.object({
      name: z.string(),
      dtype: z.string(),
      uniqueValues: z.array(z.unknown()).optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })),
  })).optional(),
}).optional();

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  filename: z.string(),
  createdAt: z.date(),
  uploadStatus: z.nativeEnum(DocumentUploadStatus),
  text: z.string().optional(),
  adminCreated: z.boolean(),
  dataProfile: DataProfileSchema.nullable().optional(),
  assignedGroupIds: z.array(z.string().uuid()).optional(),
  assignedGroupLabels: z.array(z.string()).optional(),
  collections: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    color: z.string().nullable(),
    // Populated for the admin data-source view: the folder's `shared` flag and
    // its owner, used to group/label folders and gate the per-folder Share action.
    shared: z.boolean().optional(),
    ownerId: z.string().uuid().optional(),
    ownerName: z.string().optional(),
  })).optional(),
});

const DocumentLineageNodeSchema = z.object({
  userId: z.string().uuid(),
  userName: z.string(),
  userEmail: z.string().optional(),
  userGroupIds: z.array(z.string().uuid()).optional(),
});

const DocumentLineageSchema = z.object({
  depth: z.number(),
  chain: z.array(DocumentLineageNodeSchema),
});

const GraphJobInfoSchema = z.object({
  status: z.enum(['Pending', 'Building', 'Resolving', 'Completed', 'Failed']),
  jobId: z.string().optional(),
  progress: z.object({
    totalChunks: z.number().optional(),
    processedChunks: z.number().optional(),
    currentStep: z.string().optional(),
  }).optional(),
  completedAt: z.date().optional(),
  errorMessage: z.string().optional(),
});

const ShareStatusCountsSchema = z.object({
  pending: z.number(),
  accepted: z.number(),
  rejected: z.number(),
});

export const AdminDocumentSchema = DocumentSchema.extend({
  assignedGroupIds: z.array(z.string().uuid()),
  userName: z.string(),
  userEmail: z.string().optional(),
  userGroupMemberships: z.array(z.object({
    id: z.string().uuid(),
    label: z.string(),
  })),
  lineage: DocumentLineageSchema.optional(),
  graphJobInfo: GraphJobInfoSchema.optional(),
  shareStatusCounts: ShareStatusCountsSchema.optional(),
});

// Document Sharing

export const SHARED_DOCUMENT_INVITATION_EXPIRY_DAYS: number = 7;

export enum SharedDocumentActionStatus {
  Accepted = 'accepted',
  Rejected = 'rejected',
}

export type SharedDocument = {
  id: string;
  sourceDocumentId: string;
  sourceUserId: string;
  sharedWithUserGroupIds: string[];
  createdAt: Date;
  deletedAt?: Date;
};

export type SharedDocumentAction = {
  id: string;
  sharedDocumentId: string;
  copiedDocumentId?: string;
  userId: string;
  status: SharedDocumentActionStatus;
  createdAt: Date;
};

export const SharedDocumentSchema = z.object({
  id: z.string().uuid(),
  sourceDocumentId: z.string().uuid(),
  sourceUserId: z.string().uuid(),
  sharedWithUserGroupIds: z.array(z.string().uuid()),
  createdAt: z.date(),
  deletedAt: z.date().optional(),
});

export const SharedDocumentActionSchema = z.object({
  id: z.string().uuid(),
  sharedDocumentId: z.string().uuid(),
  copiedDocumentId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  status: z.nativeEnum(SharedDocumentActionStatus),
  createdAt: z.date(),
});

export const IncomingSharedDocumentSchema = z.object({
  id: z.string().uuid(),
  sourceDocumentId: z.string().uuid(),
  sourceUserId: z.string().uuid(),
  sourceFilename: z.string(),
  sharedByUsername: z.string(),
  createdAt: z.date(),
});

export type IncomingSharedDocument = z.infer<typeof IncomingSharedDocumentSchema>;

export const OutgoingSharedDocumentSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  filename: z.string(),
  sharedWithUserGroupIds: z.array(z.string().uuid()),
  createdAt: z.date(),
});

export type OutgoingSharedDocument = z.infer<typeof OutgoingSharedDocumentSchema>;

export const GetSharedDocumentsResultSchema = z.object({
  incoming: z.array(IncomingSharedDocumentSchema),
  outgoing: z.array(OutgoingSharedDocumentSchema),
});

export type GetSharedDocumentsResult = z.infer<typeof GetSharedDocumentsResultSchema>;
