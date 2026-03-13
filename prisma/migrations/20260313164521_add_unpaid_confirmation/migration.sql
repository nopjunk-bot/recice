-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "unpaidConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "unpaidConfirmedById" TEXT;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_unpaidConfirmedById_fkey" FOREIGN KEY ("unpaidConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
