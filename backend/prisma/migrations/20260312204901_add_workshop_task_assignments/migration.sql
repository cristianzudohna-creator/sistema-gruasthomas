-- CreateEnum
CREATE TYPE "WorkshopTaskAssignmentRole" AS ENUM ('RESPONSABLE', 'APOYO');

-- CreateTable
CREATE TABLE "WorkshopTaskAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workshopTaskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkshopTaskAssignmentRole" NOT NULL DEFAULT 'APOYO',

    CONSTRAINT "WorkshopTaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopTaskAssignment_workshopTaskId_idx" ON "WorkshopTaskAssignment"("workshopTaskId");

-- CreateIndex
CREATE INDEX "WorkshopTaskAssignment_userId_idx" ON "WorkshopTaskAssignment"("userId");

-- CreateIndex
CREATE INDEX "WorkshopTaskAssignment_role_idx" ON "WorkshopTaskAssignment"("role");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopTaskAssignment_workshopTaskId_userId_key" ON "WorkshopTaskAssignment"("workshopTaskId", "userId");

-- AddForeignKey
ALTER TABLE "WorkshopTaskAssignment" ADD CONSTRAINT "WorkshopTaskAssignment_workshopTaskId_fkey" FOREIGN KEY ("workshopTaskId") REFERENCES "WorkshopTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTaskAssignment" ADD CONSTRAINT "WorkshopTaskAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
