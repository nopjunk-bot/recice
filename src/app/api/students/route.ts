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

  const where: Record<string, unknown> = {};

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

  const [students, totalCount, roomsData] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { studentCode: "asc" },
      include: {
        _count: { select: { receipts: true } },
        ...(includeDistributions && { distributions: { include: { item: true } } }),
      },
    }),
    prisma.student.count(),
    prisma.student.findMany({
      select: { room: true },
      distinct: ["room"],
      orderBy: { room: "asc" },
    }),
  ]);

  return NextResponse.json({
    students,
    totalCount,
    rooms: roomsData.map((r) => r.room),
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role === "WELFARE_STAFF") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();

  await prisma.welfareDistribution.deleteMany({ where: { studentId: id } });
  await prisma.receipt.deleteMany({ where: { studentId: id } });
  await prisma.student.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
