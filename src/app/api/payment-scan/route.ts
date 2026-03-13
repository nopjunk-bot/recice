import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET: lookup student by barcode and auto-mark as paid
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode") || "";

  if (!barcode) {
    return NextResponse.json({ error: "กรุณาสแกน Barcode" }, { status: 400 });
  }

  // Barcode format: studentCode-receiptType
  const studentCode = barcode.split("-")[0];

  const student = await prisma.student.findFirst({
    where: {
      OR: [{ studentCode }, { studentCode: barcode }],
    },
    include: {
      receipts: {
        select: {
          id: true,
          receiptNumber: true,
          totalAmount: true,
          paidAt: true,
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json(
      { error: "ไม่พบข้อมูลนักเรียน" },
      { status: 404 }
    );
  }

  const receipt = student.receipts[0];

  if (!receipt) {
    return NextResponse.json(
      { error: "นักเรียนยังไม่มีใบเสร็จ กรุณาพิมพ์ใบเสร็จก่อน" },
      { status: 400 }
    );
  }

  if (receipt.paidAt) {
    return NextResponse.json({
      student: {
        id: student.id,
        studentCode: student.studentCode,
        prefix: student.prefix,
        firstName: student.firstName,
        lastName: student.lastName,
        level: student.level,
        room: student.room,
        receiptType: student.receiptType,
      },
      receipt: {
        receiptNumber: receipt.receiptNumber,
        totalAmount: receipt.totalAmount,
        paidAt: receipt.paidAt,
      },
      alreadyPaid: true,
    });
  }

  // Auto-mark as paid
  const updatedReceipt = await prisma.receipt.update({
    where: { id: receipt.id },
    data: { paidAt: new Date() },
  });

  return NextResponse.json({
    student: {
      id: student.id,
      studentCode: student.studentCode,
      prefix: student.prefix,
      firstName: student.firstName,
      lastName: student.lastName,
      level: student.level,
      room: student.room,
      receiptType: student.receiptType,
    },
    receipt: {
      receiptNumber: updatedReceipt.receiptNumber,
      totalAmount: updatedReceipt.totalAmount,
      paidAt: updatedReceipt.paidAt,
    },
    alreadyPaid: false,
  });
}

// POST: get unpaid students list
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "unpaid-list") {
    const { search, room, level } = body;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { studentCode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (room) where.room = room;
    if (level) where.level = level;

    // Students with receipt but not paid, OR students without receipt
    const students = await prisma.student.findMany({
      where: {
        ...where,
        OR: [
          // No receipt at all
          { receipts: { none: {} }, ...where },
          // Has receipt but not paid
          {
            receipts: { some: { paidAt: null } },
            ...where,
          },
        ],
      },
      include: {
        receipts: {
          select: { id: true, paidAt: true, totalAmount: true },
          take: 1,
        },
      },
      orderBy: { studentCode: "asc" },
    });

    // Count totals
    const totalUnpaid = await prisma.student.count({
      where: {
        OR: [
          { receipts: { none: {} } },
          { receipts: { some: { paidAt: null } } },
        ],
      },
    });

    return NextResponse.json({ students, totalUnpaid });
  }

  if (action === "delete-unpaid") {
    const { studentIds } = body;

    if (!studentIds || studentIds.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเลือกนักเรียนที่ต้องการลบ" },
        { status: 400 }
      );
    }

    // Verify all selected students are actually unpaid
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: {
        receipts: { select: { paidAt: true }, take: 1 },
      },
    });

    const unpaidStudents = students.filter(
      (s) => s.receipts.length === 0 || s.receipts[0].paidAt === null
    );

    if (unpaidStudents.length === 0) {
      return NextResponse.json(
        { error: "ไม่พบนักเรียนที่ยังไม่ชำระเงิน" },
        { status: 400 }
      );
    }

    const unpaidIds = unpaidStudents.map((s) => s.id);

    // Delete related data first, then students
    await prisma.$transaction([
      prisma.welfareDistribution.deleteMany({
        where: { studentId: { in: unpaidIds } },
      }),
      prisma.receipt.deleteMany({
        where: { studentId: { in: unpaidIds } },
      }),
      prisma.student.deleteMany({
        where: { id: { in: unpaidIds } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      deletedCount: unpaidIds.length,
      message: `ลบข้อมูลนักเรียนที่ยังไม่ชำระเงินสำเร็จ ${unpaidIds.length} คน`,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
