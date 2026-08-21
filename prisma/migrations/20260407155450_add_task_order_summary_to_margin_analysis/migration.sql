/*
  Warnings:

  - Added the required column `taskOrderSummaries` to the `margin_analyses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "margin_analyses" ADD COLUMN     "taskOrderSummaries" JSONB NOT NULL;
