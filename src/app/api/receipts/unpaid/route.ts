import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { receiptConfigs, type ReceiptTypeKey } from "@/lib/receipt-config";

export async function GET() {
  const user = await getSession();
  if (!user || !["ADMIN", "FINANCE"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // นักเรียนที่มีใบเสร็จ แต่ยังไม่ได้ชำระเงิน (paidAt = null)
  const receipts = await prisma.receipt.findMany({
    where: { paidAt: null },
    select: {
      id: true,
      receiptNumber: true,
      receiptType: true,
      totalAmount: true,
      student: {
        select: {
          studentCode: true,
          prefix: true,
          firstName: true,
          lastName: true,
          level: true,
          room: true,
        },
      },
    },
    orderBy: [
      { student: { level: "asc" } },
      { student: { room: "asc" } },
      { student: { studentCode: "asc" } },
    ],
  });

  const result = receipts.map((r) => {
    const config = receiptConfigs[r.receiptType as ReceiptTypeKey];
    return {
      id: r.id,
      receiptNumber: r.receiptNumber,
      receiptType: r.receiptType,
      expectedAmount: config?.total ?? 0,
      student: r.student,
    };
  });

  return NextResponse.json(result);
}
