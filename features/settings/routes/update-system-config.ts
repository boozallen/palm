import { procedure } from '@/server/trpc';
import { z } from 'zod';
import { SystemConfigFields } from '@/features/shared/types';
import updateSystemConfig from '@/features/settings/dal/updateSystemConfig';
import { UserRole } from '@/features/shared/types/user';
import { Forbidden, BadRequest } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';

const configTypeGuardMap: Record<SystemConfigFields, (value: unknown) => boolean> = {
  [SystemConfigFields.SystemMessage]: (value): value is string => typeof value === 'string',
  [SystemConfigFields.TermsOfUseHeader]: (value): value is string => typeof value === 'string',
  [SystemConfigFields.TermsOfUseBody]: (value): value is string => typeof value === 'string',
  [SystemConfigFields.TermsOfUseCheckboxLabel]: (value): value is string => typeof value === 'string',
  [SystemConfigFields.LegalPolicyHeader]: (value): value is string => typeof value === 'string',
  [SystemConfigFields.LegalPolicyBody]: (value): value is string => typeof value === 'string',
  [SystemConfigFields.DefaultUserGroupId]: (value): value is string | null => typeof value === 'string' || value === null,
  [SystemConfigFields.SystemAiProviderModelId]: (value): value is string | null => typeof value === 'string' || value === null,
  [SystemConfigFields.DocumentLibraryKbProviderId]: (value): value is string | null => typeof value === 'string' || value === null,
  [SystemConfigFields.FeatureManagementPromptGenerator]: (value): value is boolean => typeof value === 'boolean',
  [SystemConfigFields.FeatureManagementChatSummarization]: (value): value is boolean => typeof value === 'boolean',
  [SystemConfigFields.FeatureManagementPromptTagSuggestions]: (value): value is boolean => typeof value === 'boolean',
};

function checkConfigTypeGuard(configField: SystemConfigFields, configValue: unknown): boolean {
  const typeGuard = configTypeGuardMap[configField];
  if (!typeGuard) {
    logger.error(`No type guard defined for config field: ${configField}`);
    throw new Error('An unexpected error occurred. Please try again later.');
  }
  return typeGuard(configValue);
}

const inputSchema = z.object({
  configField: z.nativeEnum(SystemConfigFields),
  configValue: z.union([z.string(), z.boolean(), z.null()]),
});

const outputSchema = z.object({
  count: z.number(),
  updatedField: z.nativeEnum(SystemConfigFields),
  updatedValue: z.union([z.string(), z.boolean(), z.null()]),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input: { configField, configValue }, ctx }) => {
    if (ctx.userRole !== UserRole.Admin) {
      throw Forbidden(
        'You do not have permission to access this resource.'
      );
    }

    if (!checkConfigTypeGuard(configField, configValue)) {
      throw BadRequest(`Invalid type for ${configField}.`);
    }

    const result = await updateSystemConfig(configField, configValue);

    return {
      count: result.count,
      updatedField: result.updatedField,
      updatedValue: result.updatedValue,
    };
  });
