-- Supports the session-expiry reconciler's per-user "most recent event" lookup
-- (server/services/sessionExpiryReconciler.ts) without a full-table sort.
CREATE INDEX "AuditRecord_userId_timestamp_idx" ON "AuditRecord"("userId", "timestamp");
