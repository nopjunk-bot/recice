-- CreateIndex
CREATE INDEX "Receipt_receiptNumber_idx" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "Receipt_receiptType_idx" ON "Receipt"("receiptType");

-- CreateIndex
CREATE INDEX "Receipt_paidAt_unpaidConfirmedAt_idx" ON "Receipt"("paidAt", "unpaidConfirmedAt");

-- CreateIndex
CREATE INDEX "Student_firstName_lastName_idx" ON "Student"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "Student_receiptType_idx" ON "Student"("receiptType");

-- CreateIndex
CREATE INDEX "WelfareDistribution_received_itemId_idx" ON "WelfareDistribution"("received", "itemId");
