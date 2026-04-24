-- AlterTable
ALTER TABLE "User" ADD COLUMN     "workerTypesExtra" "WorkerType"[] DEFAULT ARRAY[]::"WorkerType"[];

-- CreateIndex
CREATE INDEX "User_workerTypesExtra_idx" ON "User"("workerTypesExtra");
