-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "azureAdScopes" TEXT[] DEFAULT ARRAY['openid', 'profile', 'email']::TEXT[];
