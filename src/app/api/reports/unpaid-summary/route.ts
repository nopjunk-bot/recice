import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const M4_TYPES = ["M4_GENERAL", "M4_ENGLISH", "M4_CHINESE", "M4_JAPANESE"] as const;

const OUTSTANDING_ITEMS = [
  { name: "ค่าประกันอุบัติเหตุ", amount: 400 },
  { name: "ค่าระบบดูแลช่วยเหลือนักเรียน (Student Care)", amount: 150 },
  { name: "ค่าสมาคมผู้ปกครองและครู", amount: 200 },
];

const OUTSTANDING_AMOUNT = OUTSTANDING_ITEMS.reduce((s, i) => s + i.amount, 0); // 750

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
      receipts: { some: {} },
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
        orderBy: { generatedAt: "desc" },
      },
    },
    orderBy: [{ level: "asc" }, { room: "asc" }, { studentCode: "asc" }],
  });

  const result = students
    .map((s) => {
      // Dedup ตาม receiptType — เก็บใบ latest by generatedAt (orderBy desc → ตัวแรกคือล่าสุด)
      const dedup = new Map<string, (typeof s.receipts)[number]>();
      for (const r of s.receipts) {
        if (!dedup.has(r.receiptType)) dedup.set(r.receiptType, r);
      }
      const unique = [...dedup.values()];
      const paidCount = unique.filter((r) => r.paidAt !== null).length;
      const unpaidCount = unique.filter((r) => r.paidAt === null).length;
      const paidAmount = unique
        .filter((r) => r.paidAt !== null)
        .reduce((sum, r) => sum + r.totalAmount, 0);

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
        outstandingItems: OUTSTANDING_ITEMS,
        outstandingAmount: OUTSTANDING_AMOUNT,
      };
    })
    .filter((s) => s.unpaidCount > 0);

  return NextResponse.json(result);
}
