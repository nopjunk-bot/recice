import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { receiptConfigs, type ReceiptTypeKey } from "@/lib/receipt-config";

const M4_TYPES = ["M4_GENERAL", "M4_ENGLISH", "M4_CHINESE", "M4_JAPANESE"] as const;

const PRIORITY_ITEMS = [
  { name: "ค่าประกันอุบัติเหตุ", amount: 400 },
  { name: "ค่าระบบดูแลช่วยเหลือนักเรียน (Student Care)", amount: 150 },
  { name: "ค่าสมาคมผู้ปกครองและครู", amount: 200 },
];

const PRIORITY_TOTAL = PRIORITY_ITEMS.reduce((s, i) => s + i.amount, 0); // 750

type ReceiptTypeFilter =
  | { receiptType: "M1" }
  | { receiptType: { in: typeof M4_TYPES[number][] } }
  | {};

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || !["ADMIN", "FINANCE"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const level = req.nextUrl.searchParams.get("level"); // "M1" | "M4" | null

  let receiptTypeFilter: ReceiptTypeFilter = {};
  if (level === "M1") {
    receiptTypeFilter = { receiptType: "M1" };
  } else if (level === "M4") {
    receiptTypeFilter = { receiptType: { in: [...M4_TYPES] } };
  }

  const students = await prisma.student.findMany({
    where: {
      // ต้องมีใบเสร็จที่ออกผ่านหน้า "พิมพ์ใบเสร็จรับเงินชั่วคราว" (/receipts → /api/receipts/generate)
      receipts: { some: {} },
      // ตัดนักเรียนที่ "รับสินค้าแล้ว" ออก เพราะถือว่าชำระครบแล้ว (ตามที่ฝ่ายการเงินกำหนด)
      distributions: { none: { received: true } },
      ...receiptTypeFilter,
    },
    select: {
      id: true,
      studentCode: true,
      prefix: true,
      firstName: true,
      lastName: true,
      level: true,
      room: true,
      receiptType: true,
      receipts: {
        select: {
          id: true,
          paidAt: true,
          receiptType: true,
          generatedAt: true,
          totalAmount: true,
        },
      },
    },
    orderBy: [{ level: "asc" }, { room: "asc" }, { studentCode: "asc" }],
  });

  const result = students
    .map((s) => {
      // นับทุก Receipt ของนักเรียน (รวมกรณีจ่ายหลายครั้ง / มี Receipt หลายใบ)
      const allReceipts = s.receipts;
      const paidReceipts = allReceipts.filter((r) => r.paidAt !== null);
      const unpaidReceipts = allReceipts.filter((r) => r.paidAt === null);

      const paidCount = paidReceipts.length;
      const unpaidCount = unpaidReceipts.length;
      const paidAmount = paidReceipts.reduce((sum, r) => sum + r.totalAmount, 0);

      // ยอดเต็มตามเรทของ receiptType
      const expectedAmount =
        receiptConfigs[s.receiptType as ReceiptTypeKey]?.total ?? 0;

      // ยอดค้างจริง = ยอดเต็ม - ยอดที่จ่ายแล้ว
      const actualOutstanding = Math.max(0, expectedAmount - paidAmount);

      // ยอดในใบแจ้งชำระ (3 รายการสำคัญ) จำกัดไม่ให้เกินยอดค้างจริง
      const noticeAmount = Math.min(PRIORITY_TOTAL, actualOutstanding);

      return {
        studentId: s.id,
        studentCode: s.studentCode,
        prefix: s.prefix,
        firstName: s.firstName,
        lastName: s.lastName,
        level: s.level,
        room: s.room,
        receiptType: s.receiptType,
        paidCount,
        unpaidCount,
        paidAmount,
        expectedAmount,
        actualOutstanding,
        outstandingItems: PRIORITY_ITEMS,
        outstandingAmount: noticeAmount,
      };
    })
    // กรอง: เฉพาะนักเรียนที่ยังจ่ายไม่ครบจริง (ไม่ใช่นับจาก paidAt อย่างเดียว)
    .filter((s) => s.actualOutstanding > 0);

  return NextResponse.json(result);
}
