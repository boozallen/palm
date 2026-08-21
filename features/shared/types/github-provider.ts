import { z } from 'zod';

export type GitHubProvider = {
  id: string;
  label: string;
  accessToken: string;
  apiBaseUrl: string;
  owner: string;
  repo: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type SanitizedGitHubProvider = Omit<GitHubProvider, 'accessToken'> & {
  accessTokenPreview: string;
};

export const addGitHubProviderSchema = z.object({
  label: z.string().min(1, 'A label is required'),
  accessToken: z.string().min(1, 'Access token is required'),
  apiBaseUrl: z.string().url('Must be a valid URL').default('https://api.github.com'),
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository is required'),
  description: z.string().default(''),
});

export const editGitHubProviderSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, 'A label is required'),
  accessToken: z.string().optional(),
  apiBaseUrl: z.string().url('Must be a valid URL'),
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository is required'),
  description: z.string(),
});

export type AddGitHubProviderForm = z.infer<typeof addGitHubProviderSchema>;
export type EditGitHubProviderForm = z.infer<typeof editGitHubProviderSchema>;
