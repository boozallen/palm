-- Restore UUID default on AgentProvider.id
-- The default was dropped by 20260423183647_add_activit_dashboard_enabled_to_user_group
-- due to schema/DB drift at the time that migration was generated.
-- This migration is idempotent and safe to re-run.

ALTER TABLE "AgentProvider" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
