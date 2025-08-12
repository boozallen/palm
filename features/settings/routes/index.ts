import { router } from '@/server/trpc';
import getAiProvider from './get-ai-provider';
import addAiProvider from './add-ai-provider';
import deleteAiProvider from './delete-ai-provider';
import updateAiProvider from './update-ai-provider';
import updateSystemConfig from './update-system-config';
import addAiProviderModel from './add-ai-provider-model';
import updateAiProviderModel from './update-ai-provider-model';
import getAiProviders from './get-ai-providers';
import deleteAiProviderModel from './delete-ai-provider-model';
import getModels from './get-models';
import getKnowledgeBases from './get-knowledge-bases';
import createKnowledgeBase from './create-knowledge-base';
import updateKnowledgeBase from './update-knowledge-base';
import deleteKnowledgeBase from './delete-knowledge-base';
import getKbProvider from './get-kb-provider';
import getKbProviders from './get-kb-providers';
import addKbProvider from './add-kb-provider';
import updateKbProvider from './update-kb-provider';
import deleteKbProvider from './delete-kb-provider';
import createUserGroup from './create-user-group';
import getUserGroup from './get-user-group';
import deleteUserGroup from './delete-user-group';
import getUserGroups from './get-user-groups';
import getUserGroupsAsLead from './get-user-groups-as-lead';
import createUserGroupMembership from './create-user-group-membership';
import getUserGroupMemberships from './get-user-group-memberships';
import testModelStatus from './test-model-status';
import getUserGroupAiProviders from './get-user-group-ai-providers';
import updateUserGroupAiProviders from './update-user-group-ai-providers';
import getUserGroupKbProviders from './get-user-group-kb-providers';
import updateUserGroupKbProviders from './update-user-group-kb-providers';
import deleteUserGroupMembership from './delete-user-group-membership';
import getUsageRecords from './get-usage-records';
import updateUserRole from './update-user-role';
import updateUserGroupMemberRole from './update-user-group-member-role';
import getUsersListWithRole from './get-users-list-with-role';
import getUsersListWithGroupMembershipStatus from './get-users-list-with-group-membership-status';
import getSystemAdmins from './get-system-admins';
import updateAiAgent from './ai-agents/update-ai-agent';
import getAiAgent from './ai-agents/get-ai-agent';
import getAiAgents from './ai-agents/get-ai-agents';
import deleteAiAgent from './ai-agents/delete-ai-agent';
import updateUserGroupAiAgents from './update-user-group-ai-agents';
import getUserGroupAiAgents from './get-user-group-ai-agents';
import createCertaPolicy from './ai-agents/certa/create-certa-policy';
import updateCertaPolicy from './ai-agents/certa/update-certa-policy';
import deleteCertaPolicy from './ai-agents/certa/delete-certa-policy';
import getPolicyRequirements from './ai-agents/certa/get-policy-requirements';
import getCertaPolicies from './ai-agents/certa/get-certa-policies';
import getCertaRequirements from './ai-agents/certa/get-certa-requirements';
import getRadarRequirements from './ai-agents/radar/get-radar-requirements';
import generateUserGroupJoinCode from './generate-user-group-join-code';
import createAiAgent from './ai-agents/create-ai-agent';
import createDocumentUploadProvider from './document-upload/create-document-upload-provider';
import getDocumentUploadProviders from './document-upload/get-document-upload-providers';
import deleteDocumentUploadProvider from './document-upload/delete-document-upload-provider';
import getDocumentUploadRequirements from './document-upload/get-document-upload-requirements';

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
  getDocumentUploadRequirements,
});
