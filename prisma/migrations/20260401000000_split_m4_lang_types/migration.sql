-- Split M4_LANG into M4_ENGLISH, M4_CHINESE, M4_JAPANESE

-- Step 1: Create new enum type with the desired values
CREATE TYPE "ReceiptType_new" AS ENUM ('M1', 'M4_GENERAL', 'M4_ENGLISH', 'M4_CHINESE', 'M4_JAPANESE');

-- Step 2: Update Student table - convert M4_LANG to M4_ENGLISH (default)
ALTER TABLE "Student" ALTER COLUMN "receiptType" TYPE "ReceiptType_new"
  USING (CASE WHEN "receiptType"::text = 'M4_LANG' THEN 'M4_ENGLISH' ELSE "receiptType"::text END)::"ReceiptType_new";

-- Step 3: Update Receipt table - convert M4_LANG to M4_ENGLISH (default)
ALTER TABLE "Receipt" ALTER COLUMN "receiptType" TYPE "ReceiptType_new"
  USING (CASE WHEN "receiptType"::text = 'M4_LANG' THEN 'M4_ENGLISH' ELSE "receiptType"::text END)::"ReceiptType_new";

-- Step 4: Drop old enum and rename new one
DROP TYPE "ReceiptType";
ALTER TYPE "ReceiptType_new" RENAME TO "ReceiptType";
