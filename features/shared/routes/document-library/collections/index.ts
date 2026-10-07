import { router } from '@/server/trpc';

import createCollection from './create-collection';
import getCollections from './get-collections';
import updateCollection from './update-collection';
import deleteCollection from './delete-collection';
import addDocumentToCollection from './add-document-to-collection';
import removeDocumentFromCollection from './remove-document-from-collection';
import getDocumentCollections from './get-document-collections';

export const documentCollectionsRouter = router({
  createCollection,
  getCollections,
  updateCollection,
  deleteCollection,
  addDocumentToCollection,
  removeDocumentFromCollection,
  getDocumentCollections,
});
