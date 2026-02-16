-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('DOCUMENT', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "AlertDispatchLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "AlertKind" NOT NULL,
    "entityId" TEXT NOT NULL,
    "thresholdDays" INTEGER NOT NULL,
    "recipient" TEXT,
    "subject" TEXT,
    "messageId" TEXT,

    CONSTRAINT "AlertDispatchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertDispatchLog_createdAt_idx" ON "AlertDispatchLog"("createdAt");

-- CreateIndex
CREATE INDEX "AlertDispatchLog_thresholdDays_idx" ON "AlertDispatchLog"("thresholdDays");

-- CreateIndex
CREATE UNIQUE INDEX "AlertDispatchLog_kind_entityId_thresholdDays_key" ON "AlertDispatchLog"("kind", "entityId", "thresholdDays");
