-- CreateIndex
CREATE INDEX "ImportBatch_importedById_idx" ON "ImportBatch"("importedById");

-- CreateIndex
CREATE INDEX "Receipt_studentId_idx" ON "Receipt"("studentId");

-- CreateIndex
CREATE INDEX "Receipt_paidAt_idx" ON "Receipt"("paidAt");

-- CreateIndex
CREATE INDEX "Receipt_unpaidConfirmedAt_idx" ON "Receipt"("unpaidConfirmedAt");

-- CreateIndex
CREATE INDEX "Receipt_generatedById_idx" ON "Receipt"("generatedById");

-- CreateIndex
CREATE INDEX "Student_level_room_idx" ON "Student"("level", "room");

-- CreateIndex
CREATE INDEX "Student_importBatchId_idx" ON "Student"("importBatchId");

-- CreateIndex
CREATE INDEX "WelfareDistribution_studentId_idx" ON "WelfareDistribution"("studentId");

-- CreateIndex
CREATE INDEX "WelfareDistribution_itemId_idx" ON "WelfareDistribution"("itemId");

-- CreateIndex
CREATE INDEX "WelfareDistribution_received_idx" ON "WelfareDistribution"("received");
