import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { z } from 'zod';

export type SystemConfigs = {
  systemMessage: string;
  termsOfUseHeader: string;
  termsOfUseBody: string;
  termsOfUseCheckboxLabel: string;
  legalPolicyHeader: string;
  legalPolicyBody: string;
  defaultUserGroupId: string | null;
  systemAiProviderModelId: string | null;
  documentLibraryKbProviderId: string | null;
  featureManagementPromptGenerator: boolean;
  featureManagementChatSummarization: boolean;
  featureManagementPromptTagSuggestions: boolean;
};

export enum SystemConfigFields {
  SystemMessage = 'systemMessage',
  TermsOfUseHeader = 'termsOfUseHeader',
  TermsOfUseBody = 'termsOfUseBody',
  TermsOfUseCheckboxLabel = 'termsOfUseCheckboxLabel',
  LegalPolicyHeader = 'legalPolicyHeader',
  LegalPolicyBody = 'legalPolicyBody',
  DefaultUserGroupId = 'defaultUserGroupId',
  SystemAiProviderModelId = 'systemAiProviderModelId',
  DocumentLibraryKbProviderId = 'documentLibraryKbProviderId',
  FeatureManagementPromptGenerator = 'featureManagementPromptGenerator',
  FeatureManagementChatSummarization = 'featureManagementChatSummarization',
  FeatureManagementPromptTagSuggestions = 'featureManagementPromptTagSuggestions',
}

export type SystemConfigField = {
  enabled: boolean;
  name: string;
};

export const SystemConfigLabels: Record<SystemConfigFields, string> = {
  [SystemConfigFields.SystemMessage]: 'System Message',
  [SystemConfigFields.TermsOfUseHeader]: 'Terms Of Use Header',
  [SystemConfigFields.TermsOfUseBody]: 'Terms Of Use Body',
  [SystemConfigFields.TermsOfUseCheckboxLabel]: 'Terms Of Use Checkbox Label',
  [SystemConfigFields.LegalPolicyHeader]: 'Legal Policy Header',
  [SystemConfigFields.LegalPolicyBody]: 'Legal Policy Body',
  [SystemConfigFields.DefaultUserGroupId]: 'Default User Group ID',
  [SystemConfigFields.SystemAiProviderModelId]: 'System AI Provider Model ID',
  [SystemConfigFields.DocumentLibraryKbProviderId]: 'Document Library KB Provider ID',
  [SystemConfigFields.FeatureManagementPromptGenerator]: 'Prompt Generator',
  [SystemConfigFields.FeatureManagementChatSummarization]: 'Chat Title Generation',
  [SystemConfigFields.FeatureManagementPromptTagSuggestions]: 'Prompt Tag Suggestions',
};

export function useGetConfigValue(field: SystemConfigFields) {
  const { data } = useGetSystemConfig();
  if (data) {
    const config: SystemConfigs = data;
    return config[field];
  }
};

export const systemMessageSchema = z.object({
  systemMessage: z.string().min(1, { message: 'Message cannot be empty' }),
});

export const termsOfUseSchema = z.object({
  termsOfUseHeader: z.string().trim().min(1, { message: 'Header cannot be empty' }),
  termsOfUseBody: z.string().trim().min(1, { message: 'Body cannot be empty' }),
  termsOfUseCheckboxLabel: z.string().trim().min(1, { message: 'Checkbox label cannot be empty' }),
});

export const legalPolicySchema = z.object({
  legalPolicyHeader: z.string().trim().min(1, { message: 'Header cannot be empty' }),
  legalPolicyBody: z.string().trim().min(1, { message: 'Body cannot be empty' }),
});

export type SystemMessageFormValues = z.infer<typeof systemMessageSchema>;
