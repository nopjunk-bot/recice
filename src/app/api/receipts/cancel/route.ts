import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่ยกเลิกใบเสร็จได้" },
      { status: 401 }
    );
  }

  const { receiptId, reason } = await req.json();
  if (!receiptId || !reason || !reason.trim()) {
    return NextResponse.json(
      { error: "กรุณาระบุเหตุผลในการยกเลิก" },
      { status: 400 }
    );
  }

  // ดึงข้อมูลใบเสร็จก่อนลบ
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      student: {
        select: {
          studentCode: true,
          prefix: true,
          firstName: true,
          lastName: true,
        },
      },
      documentRequests: { select: { id: true } },
    },
  });

  if (!receipt) {
    return NextResponse.json({ error: "ไม่พบใบเสร็จนี้" }, { status: 404 });
  }

  // ป้องกันการลบถ้ามี DocumentRequest อ้างอิงอยู่
  if (receipt.documentRequests.length > 0) {
    return NextResponse.json(
      {
        error:
          "ไม่สามารถยกเลิกใบเสร็จนี้ได้ เนื่องจากมีคำขอเอกสารอ้างอิงอยู่ กรุณาลบคำขอเอกสารก่อน",
      },
      { status: 400 }
    );
  }

  const studentName = `${receipt.student.prefix}${receipt.student.firstName} ${receipt.student.lastName}`;

  // บันทึก audit log และลบใบเสร็จใน transaction เดียว
  await prisma.$transaction([
    prisma.receiptCancelLog.create({
      data: {
        receiptNumber: receipt.receiptNumber,
        studentCode: receipt.student.studentCode,
        studentName,
        receiptType: receipt.receiptType,
        totalAmount: receipt.totalAmount,
        reason: reason.trim(),
        cancelledById: user.id,
        cancelledByName: user.name,
      },
    }),
    prisma.receipt.delete({ where: { id: receiptId } }),
  ]);

  return NextResponse.json({ success: true });
}
