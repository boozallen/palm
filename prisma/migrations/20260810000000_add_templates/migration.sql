-- CreateTable
CREATE TABLE "ArtifactTemplate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ArtifactTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ArtifactTemplateToUserGroup" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ArtifactTemplateToUserGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ArtifactTemplateToUserGroup_B_index" ON "_ArtifactTemplateToUserGroup"("B");

-- AddForeignKey
ALTER TABLE "_ArtifactTemplateToUserGroup" ADD CONSTRAINT "_ArtifactTemplateToUserGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "ArtifactTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtifactTemplateToUserGroup" ADD CONSTRAINT "_ArtifactTemplateToUserGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
