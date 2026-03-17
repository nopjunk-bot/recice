import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// Default credentials (can be overridden with env vars)
const ACADEMIC_USERNAME = process.env.ACADEMIC_USERNAME || "academic";
const ACADEMIC_PASSWORD = process.env.ACADEMIC_PASSWORD || "academic123";

const COOKIE_NAME = "academic_session";

function isAuthenticated(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  return cookie?.value === "authenticated";
}

// POST: login or get unpaid students
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // Action: login
  if (action === "login") {
    const { username, password } = body;

    if (username !== ACADEMIC_USERNAME || password !== ACADEMIC_PASSWORD) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    (await cookies()).set(COOKIE_NAME, "authenticated", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });

    return response;
  }

  // Action: logout
  if (action === "logout") {
    const response = NextResponse.json({ success: true });
    (await cookies()).delete(COOKIE_NAME);
    return response;
  }

  // All other actions require authentication
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Action: unpaid-list
  if (action === "unpaid-list") {
    const { search, room, level } = body;

    const whereFilters: Record<string, unknown> = {};

    if (search) {
      whereFilters.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { studentCode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (room) whereFilters.room = room;
    if (level) whereFilters.level = level;

    const unpaidCondition = {
      receipts: {
        some: { paidAt: null, unpaidConfirmedAt: { not: null } },
      },
    };

    const hasFilters = !!(search || room || level);

    // รัน queries ทั้งหมดพร้อมกัน — ลดเวลารอ
    const [students, rooms, totalUnpaid] = await Promise.all([
      // Query หลัก: นักเรียนค้างชำระ (พร้อม filters)
      prisma.student.findMany({
        where: { ...whereFilters, ...unpaidCondition },
        include: {
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
      }),
      // ดึง rooms/levels สำหรับ dropdown (ไม่มี filter)
      prisma.student.findMany({
        where: unpaidCondition,
        select: { level: true, room: true },
        distinct: ["level", "room"],
        orderBy: [{ level: "asc" }, { room: "asc" }],
      }),
      // นับจำนวนทั้งหมดเฉพาะเมื่อมี filter (ถ้าไม่มี filter ใช้ students.length ได้)
      hasFilters
        ? prisma.student.count({ where: unpaidCondition })
        : Promise.resolve(null),
    ]);

    // Calculate total unpaid amount
    const totalAmount = students.reduce((sum, s) => {
      const receipt = s.receipts[0];
      return sum + (receipt?.totalAmount || 0);
    }, 0);

    return NextResponse.json({
      students,
      totalUnpaid: totalUnpaid ?? students.length,
      totalAmount,
      rooms,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
