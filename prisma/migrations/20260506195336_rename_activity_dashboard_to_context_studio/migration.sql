/*
  Warnings:

  - You are about to drop the column `activityDashboardEnabled` on the `UserGroup` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserGroup" DROP COLUMN "activityDashboardEnabled",
ADD COLUMN     "contextStudioEnabled" BOOLEAN NOT NULL DEFAULT false;
