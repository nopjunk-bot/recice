import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mode, studentIds } = await req.json();

  if (mode === "selected") {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเลือกนักเรียนที่ต้องการลบ" },
        { status: 400 }
      );
    }

    // ลบข้อมูลที่เกี่ยวข้องทั้งหมดใน transaction เดียว
    await prisma.$transaction([
      prisma.welfareDistribution.deleteMany({
        where: { studentId: { in: studentIds } },
      }),
      prisma.receipt.deleteMany({
        where: { studentId: { in: studentIds } },
      }),
      prisma.student.deleteMany({
        where: { id: { in: studentIds } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      deleted: studentIds.length,
      message: `ลบข้อมูลนักเรียนสำเร็จ ${studentIds.length} คน`,
    });
  }

  if (mode === "all") {
    // นับจำนวนก่อนลบ
    const count = await prisma.student.count();

    if (count === 0) {
      return NextResponse.json(
        { error: "ไม่มีข้อมูลนักเรียนในระบบ" },
        { status: 400 }
      );
    }

    // ลบข้อมูลทั้งหมดใน transaction เดียว
    await prisma.$transaction([
      prisma.welfareDistribution.deleteMany(),
      prisma.receipt.deleteMany(),
      prisma.student.deleteMany(),
      prisma.importBatch.deleteMany(),
    ]);

    return NextResponse.json({
      success: true,
      deleted: count,
      message: `ลบข้อมูลนักเรียนทั้งหมดสำเร็จ ${count} คน`,
    });
  }

  return NextResponse.json(
    { error: "โหมดการลบไม่ถูกต้อง" },
    { status: 400 }
  );
}
