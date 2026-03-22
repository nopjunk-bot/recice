-- CreateIndex
CREATE INDEX "DocumentRequest_createdAt_idx" ON "DocumentRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Receipt_studentId_paidAt_idx" ON "Receipt"("studentId", "paidAt");
