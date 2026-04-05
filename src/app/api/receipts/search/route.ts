import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";

  if (search.length < 2) {
    return NextResponse.json([]);
  }

  // ค้นจาก receiptNumber หรือ ข้อมูลนักเรียน (studentCode, firstName, lastName)
  const receipts = await prisma.receipt.findMany({
    where: {
      OR: [
        { receiptNumber: { contains: search, mode: "insensitive" } },
        { student: { studentCode: { contains: search, mode: "insensitive" } } },
        { student: { firstName: { contains: search, mode: "insensitive" } } },
        { student: { lastName: { contains: search, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      receiptNumber: true,
      receiptType: true,
      totalAmount: true,
      paidAt: true,
      generatedAt: true,
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
    orderBy: { generatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(receipts);
}
