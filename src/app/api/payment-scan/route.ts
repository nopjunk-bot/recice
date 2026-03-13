import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET: lookup student by barcode and confirm as unpaid
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

  const student = await prisma.student.findUnique({
    where: { studentCode },
    include: {
      receipts: {
        select: {
          id: true,
          receiptNumber: true,
          totalAmount: true,
          paidAt: true,
          unpaidConfirmedAt: true,
        },
        take: 1,
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

  const studentData = {
    id: student.id,
    studentCode: student.studentCode,
    prefix: student.prefix,
    firstName: student.firstName,
    lastName: student.lastName,
    level: student.level,
    room: student.room,
    receiptType: student.receiptType,
  };

  const receiptData = {
    receiptNumber: receipt.receiptNumber,
    totalAmount: receipt.totalAmount,
  };

  // Case 1: Already paid — no action needed
  if (receipt.paidAt) {
    return NextResponse.json({
      student: studentData,
      receipt: receiptData,
      status: "already_paid",
    });
  }

  // Case 2: Already confirmed as unpaid
  if (receipt.unpaidConfirmedAt) {
    return NextResponse.json({
      student: studentData,
      receipt: receiptData,
      status: "already_confirmed",
    });
  }

  // Case 3: Confirm as unpaid
  await prisma.receipt.update({
    where: { id: receipt.id },
    data: {
      unpaidConfirmedAt: new Date(),
      unpaidConfirmedById: user.id,
    },
  });

  return NextResponse.json({
    student: studentData,
    receipt: receiptData,
    status: "confirmed_unpaid",
  });
}

// POST: get unpaid students report
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
          { receipts: { none: {} }, ...where },
          {
            receipts: { some: { paidAt: null } },
            ...where,
          },
        ],
      },
      include: {
        receipts: {
          select: {
            id: true,
            paidAt: true,
            totalAmount: true,
            unpaidConfirmedAt: true,
            unpaidConfirmedBy: {
              select: { name: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { studentCode: "asc" },
    });

    // Count totals
    const [totalUnpaid, totalConfirmed] = await Promise.all([
      prisma.student.count({
        where: {
          OR: [
            { receipts: { none: {} } },
            { receipts: { some: { paidAt: null } } },
          ],
        },
      }),
      prisma.receipt.count({
        where: {
          paidAt: null,
          unpaidConfirmedAt: { not: null },
        },
      }),
    ]);

    return NextResponse.json({ students, totalUnpaid, totalConfirmed });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
