-- AlterTable
ALTER TABLE "UserGroup"
  ADD COLUMN "deletedAt" TIMESTAMPTZ(6);

-- label has no DB-level uniqueness (see the comment on UserGroup.label in schema.prisma):
-- createUserGroup already rejects duplicate names among active groups at the app layer,
-- so a soft-deleted group's name can be reused without needing a partial index here.
DROP INDEX "UserGroup_label_key";
