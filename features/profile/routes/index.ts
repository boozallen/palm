import { router } from '@/server/trpc';
import updateUserPreselectedKnowledgeBases from './update-user-preselected-knowledge-bases';
import getUserGroups from './getUserGroups';
import joinUserGroupViaJoinCode from './join-user-group-via-join-code';
import updateUserKbSettingsMaxResults from './update-user-kb-settings-max-results';
import updateUserKbSettingsMinScore from './update-user-kb-settings-min-score';

export default router({
  updateUserPreselectedKnowledgeBases,
  getUserGroups,
  joinUserGroupViaJoinCode,
  updateUserKbSettingsMaxResults,
  updateUserKbSettingsMinScore,
});
