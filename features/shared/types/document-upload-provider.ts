import { z } from 'zod';
import { SelectOption } from './forms';

export enum DocumentUploadProviderType {
  AWS = 1,
};

export const documentUploadProviderLabels: Record<DocumentUploadProviderType, string> = {
  [DocumentUploadProviderType.AWS]: 'Amazon Web Services (AWS)',
};

const awsProviderConfigSchema = z.object({
  providerType: z.literal(DocumentUploadProviderType.AWS),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  sessionToken: z.string().optional(),
  region: z.string(),
  s3Uri: z.string(),
});

export const documentUploadProviderConfigSchema = z.discriminatedUnion('providerType', [
  awsProviderConfigSchema,
  /* Add more provider config schemas here */
]);

export type DocumentUploadProviderConfig = z.infer<typeof documentUploadProviderConfigSchema>;

export type DocumentUploadProvider = {
  id: string;
  label: string;
  config: DocumentUploadProviderConfig;
}

export type SanitizedDocumentUploadProvider = {
  id: string;
  label: string;
  providerType: DocumentUploadProviderType;
  sourceUri: string;
}

export const documentUploadProviderSelectOptions: SelectOption[] = Object
  .entries(documentUploadProviderLabels)
  .filter(([key, _]) => !isNaN(Number(key)))
  .map(([key, value]) => ({
    value: key,
    label: value,
  }));

const providerConfigSchema = z.discriminatedUnion('providerType', [
  /* Mantine select does not not work well with int values;
   * parse providerType to be a string
  */
  z.object({
    providerType: z.literal(`${DocumentUploadProviderType.AWS}`),
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    sessionToken: z.string(),
    region: z.string(),
    s3Uri: z.string().min(1, 'An S3 URI is required'),
  }),
], { errorMap: () => ({ message: 'Select a valid provider' }) });

export const addDocumentUploadProviderSchema = z
  .object({
    label: z.string().min(1, 'A label is required'),
    config: providerConfigSchema,
  });

export type ProviderConfigForm = z.infer<typeof providerConfigSchema>;
export type AddProviderForm = z.infer<typeof addDocumentUploadProviderSchema>;

export const initializeConfigValuesForProviderType: Record<DocumentUploadProviderType, ProviderConfigForm> = {
  [DocumentUploadProviderType.AWS]: {
    providerType: `${DocumentUploadProviderType.AWS}`,
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    region: '',
    s3Uri: '',
  },
};
