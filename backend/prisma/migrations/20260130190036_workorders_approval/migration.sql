-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "approvalComment" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "rejectReason" TEXT;

-- CreateIndex
CREATE INDEX "WorkOrder_approvedAt_idx" ON "WorkOrder"("approvedAt");

-- CreateIndex
CREATE INDEX "WorkOrder_approvedById_idx" ON "WorkOrder"("approvedById");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
