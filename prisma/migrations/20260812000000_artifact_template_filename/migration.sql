-- Merge name + fileType into a single filename column on ArtifactTemplate
ALTER TABLE "ArtifactTemplate" ADD COLUMN "filename" TEXT;
UPDATE "ArtifactTemplate" SET "filename" = name || '.' || "fileType";
ALTER TABLE "ArtifactTemplate" ALTER COLUMN "filename" SET NOT NULL;
ALTER TABLE "ArtifactTemplate" DROP COLUMN "name";
ALTER TABLE "ArtifactTemplate" DROP COLUMN "fileType";
