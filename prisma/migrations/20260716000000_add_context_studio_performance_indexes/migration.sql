-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditRecord_event_outcome_timestamp_idx" ON "AuditRecord"("event", "outcome", "timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditRecord_event_outcome_userId_timestamp_idx" ON "AuditRecord"("event", "outcome", "userId", "timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Account_userId_updatedAt_idx" ON "Account"("userId", "updatedAt");
