import { router } from '@/server/trpc';
import getAiProvider from './ai-providers/get-ai-provider';
import addAiProvider from './ai-providers/add-ai-provider';
import deleteAiProvider from './ai-providers/delete-ai-provider';
import updateAiProvider from './ai-providers/update-ai-provider';
import updateSystemConfig from './system-configurations/update-system-config';
import addAiProviderModel from './ai-providers/add-ai-provider-model';
import updateAiProviderModel from './ai-providers/update-ai-provider-model';
import getAiProviders from './ai-providers/get-ai-providers';
import deleteAiProviderModel from './ai-providers/delete-ai-provider-model';
import getModels from './ai-providers/get-models';
import getKnowledgeBases from './kb-providers/get-knowledge-bases';
import createKnowledgeBase from './kb-providers/create-knowledge-base';
import updateKnowledgeBase from './kb-providers/update-knowledge-base';
import deleteKnowledgeBase from './kb-providers/delete-knowledge-base';
import getKbProvider from './kb-providers/get-kb-provider';
import getKbProviders from './kb-providers/get-kb-providers';
import addKbProvider from './kb-providers/add-kb-provider';
import updateKbProvider from './kb-providers/update-kb-provider';
import deleteKbProvider from './kb-providers/delete-kb-provider';
import createUserGroup from './user-groups/create-user-group';
import getUserGroup from './user-groups/get-user-group';
import deleteUserGroup from './user-groups/delete-user-group';
import getUserGroups from './user-groups/get-user-groups';
import getUserGroupsAsLead from './user-groups/get-user-groups-as-lead';
import createUserGroupMembership from './user-groups/create-user-group-membership';
import getUserGroupMemberships from './user-groups/get-user-group-memberships';
import testModelStatus from './ai-providers/test-model-status';
import getUserGroupAiProviders from './user-groups/get-user-group-ai-providers';
import updateUserGroupAiProviders from './user-groups/update-user-group-ai-providers';
import getUserGroupKbProviders from './user-groups/get-user-group-kb-providers';
import updateUserGroupKbProviders from './user-groups/update-user-group-kb-providers';
import deleteUserGroupMembership from './user-groups/delete-user-group-membership';
import getUsageRecords from './analytics/get-usage-records';
import updateUserRole from './admins/update-user-role';
import updateUserGroupMemberRole from './user-groups/update-user-group-member-role';
import getUsersListWithRole from './admins/get-users-list-with-role';
import getUsersListWithGroupMembershipStatus from './user-groups/get-users-list-with-group-membership-status';
import getSystemAdmins from './admins/get-system-admins';
import updateAiAgent from './ai-agents/update-ai-agent';
import getAiAgent from './ai-agents/get-ai-agent';
import getAiAgents from './ai-agents/get-ai-agents';
import deleteAiAgent from './ai-agents/delete-ai-agent';
import updateUserGroupAiAgents from './user-groups/update-user-group-ai-agents';
import getUserGroupAiAgents from './user-groups/get-user-group-ai-agents';
import createCertaPolicy from './ai-agents/certa/create-certa-policy';
import updateCertaPolicy from './ai-agents/certa/update-certa-policy';
import deleteCertaPolicy from './ai-agents/certa/delete-certa-policy';
import getPolicyRequirements from './ai-agents/certa/get-policy-requirements';
import getCertaPolicies from './ai-agents/certa/get-certa-policies';
import getCertaRequirements from './ai-agents/certa/get-certa-requirements';
import getRadarRequirements from './ai-agents/radar/get-radar-requirements';
import generateUserGroupJoinCode from './user-groups/generate-user-group-join-code';
import createAiAgent from './ai-agents/create-ai-agent';
import createDocumentUploadProvider from './document-upload/create-document-upload-provider';
import getDocumentUploadProviders from './document-upload/get-document-upload-providers';
import deleteDocumentUploadProvider from './document-upload/delete-document-upload-provider';

export default router({
  getAiProvider,
  addAiProvider,
  deleteAiProvider,
  deleteAiProviderModel,
  updateAiProvider,
  updateSystemConfig,
  addAiProviderModel,
  updateAiProviderModel,
  getAiProviders,
  getModels,
  getKnowledgeBases,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  updateUserGroupKbProviders,
  getKbProvider,
  getKbProviders,
  addKbProvider,
  updateKbProvider,
  deleteKbProvider,
  getUserGroupKbProviders,
  deleteUserGroupMembership,
  createUserGroup,
  getUserGroup,
  deleteUserGroup,
  getUserGroups,
  getUserGroupsAsLead,
  createUserGroupMembership,
  getUserGroupMemberships,
  getUserGroupAiProviders,
  updateUserGroupAiProviders,
  testModelStatus,
  getUsageRecords,
  updateUserRole,
  updateUserGroupMemberRole,
  getUsersListWithRole,
  getUsersListWithGroupMembershipStatus,
  getSystemAdmins,
  updateAiAgent,
  getAiAgent,
  getAiAgents,
  deleteAiAgent,
  updateUserGroupAiAgents,
  getUserGroupAiAgents,
  createCertaPolicy,
  updateCertaPolicy,
  deleteCertaPolicy,
  getPolicyRequirements,
  getCertaPolicies,
  getCertaRequirements,
  getRadarRequirements,
  generateUserGroupJoinCode,
  createAiAgent,
  createDocumentUploadProvider,
  getDocumentUploadProviders,
  deleteDocumentUploadProvider,
});
