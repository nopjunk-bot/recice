-- CreateTable
CREATE TABLE "ReceiptCancelLog" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "receiptType" "ReceiptType" NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledById" TEXT NOT NULL,
    "cancelledByName" TEXT NOT NULL,

    CONSTRAINT "ReceiptCancelLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptCancelLog_cancelledAt_idx" ON "ReceiptCancelLog"("cancelledAt");

-- CreateIndex
CREATE INDEX "ReceiptCancelLog_studentCode_idx" ON "ReceiptCancelLog"("studentCode");

-- CreateIndex
CREATE INDEX "ReceiptCancelLog_receiptNumber_idx" ON "ReceiptCancelLog"("receiptNumber");
