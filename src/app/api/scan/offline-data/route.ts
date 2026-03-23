import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET: ดาวน์โหลดข้อมูลนักเรียนทั้งหมด + welfare items สำหรับ offline mode
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [students, welfareItems] = await Promise.all([
    prisma.student.findMany({
      select: {
        id: true,
        studentCode: true,
        prefix: true,
        firstName: true,
        lastName: true,
        level: true,
        room: true,
        receiptType: true,
        distributions: {
          select: {
            id: true,
            itemId: true,
            received: true,
            pendingSize: true,
            item: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { studentCode: "asc" },
    }),
    prisma.welfareItem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    students,
    welfareItems,
    syncedAt: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "private, max-age=120, stale-while-revalidate=60",
    },
  });
}
