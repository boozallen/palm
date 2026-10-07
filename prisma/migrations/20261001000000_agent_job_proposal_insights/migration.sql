-- AlterTable
ALTER TABLE "AgentPrismJob" ADD COLUMN     "proposalName" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "opportunitySummary" TEXT,
ADD COLUMN     "financialValue" TEXT;

-- AlterTable
ALTER TABLE "AgentOdramJob" ADD COLUMN     "proposalName" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "opportunitySummary" TEXT,
ADD COLUMN     "financialValue" TEXT;
