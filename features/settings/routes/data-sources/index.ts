import { router } from '@/server/trpc';
import getPresignedUrl from './get-presigned-url';
import createAdminDocument from './create-admin-document';
import getAdminDocuments from './get-admin-documents';
import getDocuments from './get-documents';
import assignGroups from './assign-groups';
import promoteFromLibrary from './promote-admin-document';
import demoteAdminDocument from './demote-admin-document';
import demoteCollection from './demote-admin-document-collection';

export default router({
  getPresignedUrl,
  createAdminDocument,
  getAdminDocuments,
  getDocuments,
  assignGroups,
  promoteFromLibrary,
  demoteAdminDocument,
  demoteCollection,
});
