import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { UserRole } from '@/features/shared/types/user';
import { Unauthorized } from '@/features/shared/errors/routeErrors';
import updateGitHubProvider from '@/features/settings/dal/github-providers/updateGitHubProvider';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

const inputSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, 'A label is required'),
  accessToken: z.string().optional(),
  apiBaseUrl: z.string().url('Must be a valid URL'),
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository is required'),
  description: z.string().default(''),
  isSkillRepo: z.boolean().optional(),
  skillRepoBranch: z.string().nullable().optional(),
  skillRepoServiceUrl: z.string().nullable().optional(),
});

const outputSchema = z.object({
  githubProvider: z.object({
    id: z.string().uuid(),
    label: z.string(),
    apiBaseUrl: z.string(),
    owner: z.string(),
    repo: z.string(),
    description: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ ctx, input }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Unauthorized('You do not have permission to update a GitHub provider');
    }

    const provider = await updateGitHubProvider({
      id: input.id,
      label: input.label,
      accessToken: input.accessToken,
      apiBaseUrl: input.apiBaseUrl,
      owner: input.owner,
      repo: input.repo,
      description: input.description,
      isSkillRepo: input.isSkillRepo,
      skillRepoBranch: input.skillRepoBranch,
      skillRepoServiceUrl: input.skillRepoServiceUrl,
    });

    ctx.auditor.createAuditRecord({
      outcome: AuditRecordOutcome.Success,
      event: AuditRecordEvent.ConfigureGithubProvider,
      description: `GitHub provider "${input.label}" was updated (skill repo: ${input.isSkillRepo ?? false})`,
    });

    return {
      githubProvider: {
        id: provider.id,
        label: provider.label,
        apiBaseUrl: provider.apiBaseUrl,
        owner: provider.owner,
        repo: provider.repo,
        description: provider.description,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      },
    };
  });
