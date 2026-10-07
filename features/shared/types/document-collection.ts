export type DocumentCollection = {
  id: string;
  name: string;
  color: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentCollectionWithCounts = DocumentCollection & {
  documentCount: number;
};

export type DocumentCollectionMembership = {
  documentId: string;
  collectionId: string;
  addedAt: Date;
};

export type DocumentWithCollections = {
  id: string;
  filename: string;
  collections: DocumentCollection[];
};
