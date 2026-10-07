/*
  Warnings:

  - You are about to drop the `PersonalDocument` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PersonalDocument" DROP CONSTRAINT "PersonalDocument_userId_fkey";

-- DropTable
DROP TABLE "PersonalDocument";

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadStatus" TEXT NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
