-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "workerReport" JSONB;

-- CreateIndex
CREATE INDEX "WorkOrder_completedAt_idx" ON "WorkOrder"("completedAt");

-- CreateIndex
CREATE INDEX "WorkOrder_completedById_idx" ON "WorkOrder"("completedById");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
