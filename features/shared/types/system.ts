import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { z } from 'zod';

export type SystemConfigs = {
  systemMessage: string;
  termsOfUseHeader: string;
  termsOfUseBody: string;
  termsOfUseCheckboxLabel: string;
  legalPolicyHeader: string;
  legalPolicyBody: string;
  joinUserGroupDialogExternalLink: string;
  defaultUserGroupId: string | null;
  systemAiProviderModelId: string | null;
  fastAiProviderModelId: string | null;
  knowledgeGraphAiProviderModelId: string | null;
  knowledgeGraphEntityResolutionEnabled: boolean;
  memoryEnabled: boolean;
  documentLibraryDocumentUploadProviderId: string | null;
  featureManagementPromptGenerator: boolean;
  featureManagementChatSummarization: boolean;
  featureManagementPromptTagSuggestions: boolean;
  documentLibraryDataSharingEnabled: boolean;
  azureAdScopes: string[];
  azureAdEnabled: boolean;
};

export enum AzureAdScope {
  OpenId = 'openid',
  Profile = 'profile',
  Email = 'email',
  OfflineAccess = 'offline_access',
  SitesReadAll = 'Sites.Read.All',
  FilesReadAll = 'Files.Read.All',
  GroupMemberReadAll = 'GroupMember.Read.All',
}

export type AzureAdScopeService = 'OpenID Connect' | 'Microsoft Graph';

type AzureAdScopeMetadata = {
  service: AzureAdScopeService;
  description: string;
  features: string[];
  // NextAuth needs this scope to sign a user in; removing it breaks Azure AD login.
  required: boolean;
};

// Single source of truth for every selectable Azure AD scope: which service it belongs to,
// what it's for, and whether NextAuth requires it. Everything scope-related (the picker's
// options, the info popover, and which scopes can't be removed) derives from this.
export const AZURE_AD_SCOPE_DETAILS: Record<AzureAdScope, AzureAdScopeMetadata> = {
  [AzureAdScope.OpenId]: {
    service: 'OpenID Connect',
    description: 'Returns unique identity in the `sub` claim.',
    features: ['Required to sign in and acquire an ID token'],
    required: true,
  },
  [AzureAdScope.Profile]: {
    service: 'OpenID Connect',
    description: 'Returns name/username claims.',
    features: ['Populates the user\'s display name in the app'],
    required: true,
  },
  [AzureAdScope.Email]: {
    service: 'OpenID Connect',
    description: 'Returns email claim.',
    features: ['Used to match and provision the account by email'],
    required: true,
  },
  [AzureAdScope.OfflineAccess]: {
    service: 'OpenID Connect',
    description: 'Grants a refresh token.',
    features: ['Keeps the user signed in without re-authenticating every hour'],
    required: false,
  },
  [AzureAdScope.SitesReadAll]: {
    service: 'Microsoft Graph',
    description: 'Read access to all SharePoint sites.',
    features: ['Grants the app permission to read SharePoint site content on the user\'s behalf'],
    required: false,
  },
  [AzureAdScope.FilesReadAll]: {
    service: 'Microsoft Graph',
    description: 'Read access to all files.',
    features: ['Grants the app permission to read the user\'s OneDrive and SharePoint files'],
    required: false,
  },
  [AzureAdScope.GroupMemberReadAll]: {
    service: 'Microsoft Graph',
    description: 'Read access to group memberships.',
    features: ['Grants the app permission to read the user\'s Azure AD group memberships'],
    required: false,
  },
};

// OIDC scopes NextAuth needs to sign a user in; removing any of these breaks Azure AD login.
export const AZURE_AD_REQUIRED_SCOPES = Object.values(AzureAdScope).filter(
  (scope) => AZURE_AD_SCOPE_DETAILS[scope].required
);

export enum SystemConfigFields {
  SystemMessage = 'systemMessage',
  TermsOfUseHeader = 'termsOfUseHeader',
  TermsOfUseBody = 'termsOfUseBody',
  TermsOfUseCheckboxLabel = 'termsOfUseCheckboxLabel',
  LegalPolicyHeader = 'legalPolicyHeader',
  LegalPolicyBody = 'legalPolicyBody',
  JoinUserGroupDialogExternalLink = 'joinUserGroupDialogExternalLink',
  DefaultUserGroupId = 'defaultUserGroupId',
  SystemAiProviderModelId = 'systemAiProviderModelId',
  FastAiProviderModelId = 'fastAiProviderModelId',
  KnowledgeGraphAiProviderModelId = 'knowledgeGraphAiProviderModelId',
  KnowledgeGraphEntityResolutionEnabled = 'knowledgeGraphEntityResolutionEnabled',
  MemoryEnabled = 'memoryEnabled',
  DocumentLibraryDocumentUploadProviderId = 'documentLibraryDocumentUploadProviderId',
  DocumentLibraryDataSharingEnabled = 'documentLibraryDataSharingEnabled',
  FeatureManagementPromptGenerator = 'featureManagementPromptGenerator',
  FeatureManagementChatSummarization = 'featureManagementChatSummarization',
  FeatureManagementPromptTagSuggestions = 'featureManagementPromptTagSuggestions',
  AzureAdScopes = 'azureAdScopes',
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
  [SystemConfigFields.JoinUserGroupDialogExternalLink]: 'Join User Group Dialog External Link',
  [SystemConfigFields.DefaultUserGroupId]: 'Default User Group ID',
  [SystemConfigFields.SystemAiProviderModelId]: 'System AI Provider Model ID',
  [SystemConfigFields.FastAiProviderModelId]: 'Fast AI Provider Model ID',
  [SystemConfigFields.KnowledgeGraphAiProviderModelId]: 'Knowledge Graph AI Provider Model ID',
  [SystemConfigFields.KnowledgeGraphEntityResolutionEnabled]: 'Enable Entity Resolution',
  [SystemConfigFields.MemoryEnabled]: 'Memory',
  [SystemConfigFields.DocumentLibraryDocumentUploadProviderId]: 'Document Library Document Upload Provider ID',
  [SystemConfigFields.DocumentLibraryDataSharingEnabled]: 'Data Sharing',
  [SystemConfigFields.FeatureManagementPromptGenerator]: 'Prompt Generator',
  [SystemConfigFields.FeatureManagementChatSummarization]: 'Chat Title Generation',
  [SystemConfigFields.FeatureManagementPromptTagSuggestions]: 'Prompt Tag Suggestions',
  [SystemConfigFields.AzureAdScopes]: 'Azure AD Scopes',
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

export const joinUserGroupDialogSchema = z.object({
  joinUserGroupDialogExternalLink: z.union([
    z.literal(''),
    z.string().trim().url({ message: 'Must be a valid URL' }),
  ]),
});

export type SystemMessageFormValues = z.infer<typeof systemMessageSchema>;
