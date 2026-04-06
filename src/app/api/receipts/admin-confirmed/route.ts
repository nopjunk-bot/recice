import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user || !["ADMIN", "FINANCE"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // นักเรียนที่ Admin ยืนยันค้างชำระ (unpaidConfirmedAt != null, paidAt = null)
  const students = await prisma.student.findMany({
    where: {
      receipts: {
        some: { paidAt: null, unpaidConfirmedAt: { not: null } },
      },
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
        where: { paidAt: null, unpaidConfirmedAt: { not: null } },
        select: {
          id: true,
          receiptNumber: true,
          totalAmount: true,
          unpaidConfirmedAt: true,
        },
        take: 1,
      },
    },
    orderBy: [{ level: "asc" }, { room: "asc" }, { studentCode: "asc" }],
  });

  return NextResponse.json(students);
}
