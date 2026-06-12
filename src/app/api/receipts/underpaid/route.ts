import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { receiptConfigs, type ReceiptTypeKey } from "@/lib/receipt-config";

export async function GET() {
  const user = await getSession();
  if (!user || !["ADMIN", "FINANCE"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ดึงเฉพาะใบเสร็จที่ "ชำระแล้ว" (paidAt != null) เพื่อหลีกเลี่ยงการนับซ้ำกับรายงานค้างชำระเต็มจำนวน
  const receipts = await prisma.receipt.findMany({
    where: { paidAt: { not: null } },
    select: {
      id: true,
      receiptNumber: true,
      receiptType: true,
      totalAmount: true,
      paidAt: true,
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
      { paidAt: "asc" },
    ],
  });

  // รวมยอดใบเสร็จทุกใบของนักเรียนคนเดียวกัน + ประเภทเดียวกัน
  type Group = {
    receiptId: string;
    receiptNumber: string;
    receiptType: string;
    paidAmount: number;
    receiptCount: number;
    student: typeof receipts[number]["student"];
  };
  const groups = new Map<string, Group>();

  for (const r of receipts) {
    const key = `${r.student.studentCode}|${r.receiptType}`;
    const existing = groups.get(key);
    if (existing) {
      existing.paidAmount += r.totalAmount;
      existing.receiptCount += 1;
    } else {
      groups.set(key, {
        receiptId: r.id,
        receiptNumber: r.receiptNumber,
        receiptType: r.receiptType,
        paidAmount: r.totalAmount,
        receiptCount: 1,
        student: r.student,
      });
    }
  }

  // กรองเฉพาะที่ยอดรวมยังน้อยกว่ายอดเต็ม
  const underpaid = Array.from(groups.values())
    .filter((g) => {
      const config = receiptConfigs[g.receiptType as ReceiptTypeKey];
      return config && g.paidAmount < config.total;
    })
    .map((g) => {
      const config = receiptConfigs[g.receiptType as ReceiptTypeKey];
      return {
        id: g.receiptId,
        receiptNumber: g.receiptNumber,
        receiptType: g.receiptType,
        paidAmount: g.paidAmount,
        expectedAmount: config.total,
        difference: config.total - g.paidAmount,
        receiptCount: g.receiptCount,
        student: g.student,
      };
    });

  return NextResponse.json(underpaid);
}
