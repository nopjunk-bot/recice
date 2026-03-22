import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// ช่วงเวลาเปิดระบบ (พ.ศ. 2569 = ค.ศ. 2026)
const REQUEST_ROUNDS = [
  {
    round: 1,
    start: new Date(2026, 3, 5, 0, 0, 0),   // 5 เม.ย. 2569
    end: new Date(2026, 3, 7, 23, 59, 59),   // 7 เม.ย. 2569
  },
  {
    round: 2,
    start: new Date(2026, 3, 18, 0, 0, 0),  // 18 เม.ย. 2569
    end: new Date(2026, 3, 30, 23, 59, 59),  // 30 เม.ย. 2569
  },
];

function getActiveRound(now: Date): number | null {
  for (const r of REQUEST_ROUNDS) {
    if (now >= r.start && now <= r.end) return r.round;
  }
  return null;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

function formatThaiDate(date: Date): string {
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
    "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
    "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear() + 543;
  return `${d} ${m} ${y}`;
}

// POST - สร้างคำขอเอกสาร (สาธารณะ)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentCode, receiptNumber, studentName } = body;

    if (!studentCode || !receiptNumber || !studentName) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" },
        { status: 400 }
      );
    }

    // ตรวจสอบช่วงเวลาเปิดระบบ
    const now = new Date();
    const activeRound = getActiveRound(now);
    if (!activeRound) {
      return NextResponse.json(
        { error: "ขณะนี้อยู่นอกช่วงเวลาขอเอกสาร กรุณากลับมาในช่วงเวลาที่กำหนด" },
        { status: 400 }
      );
    }

    // ตรวจสอบหมายเลขนักเรียน
    const student = await prisma.student.findUnique({
      where: { studentCode: studentCode.trim() },
    });

    if (!student) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลนักเรียนด้วยหมายเลขประจำตัวนี้" },
        { status: 400 }
      );
    }

    // ตรวจสอบเลขที่ใบเสร็จ
    const receipt = await prisma.receipt.findUnique({
      where: { receiptNumber: receiptNumber.trim() },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: "ไม่พบใบเสร็จเลขที่นี้ในระบบ" },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าใบเสร็จตรงกับนักเรียน
    if (receipt.studentId !== student.id) {
      return NextResponse.json(
        { error: "ใบเสร็จเลขที่นี้ไม่ตรงกับหมายเลขนักเรียนที่ระบุ" },
        { status: 400 }
      );
    }

    // คำนวณวันรับเอกสาร (3 วันทำการ)
    const pickupDate = addBusinessDays(now, 3);

    // สร้างคำขอ (upsert ป้องกันซ้ำ)
    const docRequest = await prisma.documentRequest.upsert({
      where: {
        studentId_receiptId: {
          studentId: student.id,
          receiptId: receipt.id,
        },
      },
      update: {
        studentName: studentName.trim(),
        requestRound: activeRound,
        status: "PENDING",
        pickupDate,
      },
      create: {
        studentId: student.id,
        receiptId: receipt.id,
        studentName: studentName.trim(),
        requestRound: activeRound,
        status: "PENDING",
        pickupDate,
      },
    });

    return NextResponse.json({
      success: true,
      request: {
        id: docRequest.id,
        studentCode: student.studentCode,
        studentFullName: `${student.prefix}${student.firstName} ${student.lastName}`,
        receiptNumber: receipt.receiptNumber,
        round: activeRound,
        pickupDate: formatThaiDate(pickupDate),
      },
    });
  } catch (error) {
    console.error("Document request error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

// GET - ดูรายการคำขอ (admin เท่านั้น)
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const round = searchParams.get("round");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (round) where.requestRound = parseInt(round);
    if (search) {
      where.OR = [
        { studentName: { contains: search, mode: "insensitive" } },
        { student: { studentCode: { contains: search, mode: "insensitive" } } },
        { receipt: { receiptNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [requests, total, counts] = await Promise.all([
      prisma.documentRequest.findMany({
        where,
        include: {
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
          receipt: {
            select: {
              receiptNumber: true,
              totalAmount: true,
              receiptType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.documentRequest.count({ where }),
      prisma.documentRequest.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const statusCounts = {
      PENDING: 0,
      COMPLETED: 0,
      REJECTED: 0,
    };
    for (const c of counts) {
      statusCounts[c.status] = c._count.status;
    }

    return NextResponse.json({
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      statusCounts,
    });
  } catch (error) {
    console.error("Get document requests error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

// PATCH - อัปเดตสถานะคำขอ (admin เท่านั้น)
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status, note } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "กรุณาระบุ id และ status" },
        { status: 400 }
      );
    }

    const updated = await prisma.documentRequest.update({
      where: { id },
      data: {
        status,
        ...(note !== undefined && { note }),
      },
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error("Update document request error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
