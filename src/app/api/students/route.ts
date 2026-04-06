import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const receiptType = searchParams.get("receiptType") || "";
  const level = searchParams.get("level") || "";
  const room = searchParams.get("room") || "";
  const includeDistributions = searchParams.get("includeDistributions") === "true";
  const includeRooms = searchParams.get("includeRooms") === "true";
  const includeAllCount = searchParams.get("includeAllCount") === "true";
  // Pagination parameters
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const noPagination = searchParams.get("noPagination") === "true";

  const where: Record<string, unknown> = {};
  const hasFilter = !!(search || receiptType || level || room);

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { studentCode: { contains: search, mode: "insensitive" } },
    ];
  }

  if (receiptType) {
    where.receiptType = receiptType;
  }

  if (level) {
    where.level = level;
  }

  if (room) {
    where.room = room;
  }

  // สร้าง queries เฉพาะที่จำเป็น — ลด query ที่ไม่ได้ใช้
  const findManyArgs: Parameters<typeof prisma.student.findMany>[0] = {
    where,
    orderBy: { studentCode: "asc" },
    select: {
      id: true,
      studentCode: true,
      prefix: true,
      firstName: true,
      lastName: true,
      level: true,
      room: true,
      receiptType: true,
      _count: { select: { receipts: true } },
      ...(includeDistributions && { distributions: { include: { item: true } } }),
    },
  };

  // Pagination: skip/take หรือดึงทั้งหมดถ้า noPagination=true
  if (!noPagination) {
    findManyArgs.skip = (page - 1) * limit;
    findManyArgs.take = limit;
  }

  const queries: [
    Promise<unknown>,
    Promise<number>,
    Promise<{ room: string }[] | null>,
  ] = [
    prisma.student.findMany(findManyArgs),
    // นับจำนวนทั้งหมดตาม filter (ใช้สำหรับ pagination + allCount)
    prisma.student.count({ where }),
    // ดึง rooms เฉพาะเมื่อต้องการ (หน้าที่มี room filter)
    includeRooms
      ? prisma.student.findMany({
          select: { room: true },
          distinct: ["room"],
          orderBy: { room: "asc" },
        })
      : Promise.resolve(null),
  ];

  const [students, filteredCount, roomsData] = await Promise.all(queries);

  // allCount = จำนวนทั้งหมดโดยไม่มี filter (สำหรับหน้าจัดการนักเรียน)
  const allCount = includeAllCount && hasFilter
    ? await prisma.student.count()
    : null;

  const result: Record<string, unknown> = {
    students,
    totalCount: allCount ?? filteredCount,
    filteredCount,
    page,
    limit,
    totalPages: noPagination ? 1 : Math.ceil(filteredCount / limit),
  };

  if (roomsData) {
    result.rooms = (roomsData as { room: string }[]).map((r) => r.room);
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role === "WELFARE_STAFF") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { studentCode, prefix, firstName, lastName, level, room, receiptType } = body;

  // ตรวจสอบข้อมูลครบถ้วน
  if (!studentCode || !prefix || !firstName || !lastName || !level || !room || !receiptType) {
    return NextResponse.json(
      { error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" },
      { status: 400 }
    );
  }

  // ตรวจสอบประเภทใบเสร็จ
  const validTypes = ["M1", "M4_GENERAL", "M4_ENGLISH", "M4_CHINESE", "M4_JAPANESE"];
  if (!validTypes.includes(receiptType)) {
    return NextResponse.json(
      { error: "ประเภทใบเสร็จไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  // ตรวจสอบเลขประจำตัวซ้ำ
  const existing = await prisma.student.findUnique({
    where: { studentCode: String(studentCode).trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: `เลขประจำตัว "${studentCode}" มีอยู่ในระบบแล้ว` },
      { status: 409 }
    );
  }

  const student = await prisma.student.create({
    data: {
      studentCode: String(studentCode).trim(),
      prefix: String(prefix).trim(),
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      level: String(level).trim(),
      room: String(room).trim(),
      receiptType,
    },
  });

  return NextResponse.json({ success: true, student }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role === "WELFARE_STAFF") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();

  // ลบข้อมูลที่เกี่ยวข้องทั้งหมดใน transaction เดียว
  await prisma.$transaction([
    prisma.documentRequest.deleteMany({ where: { studentId: id } }),
    prisma.welfareDistribution.deleteMany({ where: { studentId: id } }),
    prisma.receipt.deleteMany({ where: { studentId: id } }),
    prisma.student.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}
