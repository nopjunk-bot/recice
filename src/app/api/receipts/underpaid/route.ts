import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { receiptConfigs, type ReceiptTypeKey } from "@/lib/receipt-config";

export async function GET() {
  const user = await getSession();
  if (!user || !["ADMIN", "FINANCE"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const receipts = await prisma.receipt.findMany({
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

  // กรองเฉพาะที่ชำระน้อยกว่ายอดเต็ม + dedupe ต่อนักเรียน+ประเภท
  const seen = new Set<string>();
  const underpaid = receipts
    .filter((r) => {
      const config = receiptConfigs[r.receiptType as ReceiptTypeKey];
      if (!config || r.totalAmount >= config.total) return false;
      const key = `${r.student.studentCode}|${r.receiptType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => {
      const config = receiptConfigs[r.receiptType as ReceiptTypeKey];
      return {
        id: r.id,
        receiptNumber: r.receiptNumber,
        receiptType: r.receiptType,
        paidAmount: r.totalAmount,
        expectedAmount: config.total,
        difference: config.total - r.totalAmount,
        student: r.student,
      };
    });

  return NextResponse.json(underpaid);
}
