import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "not-received";

  if (type === "not-received") {
    // Students who didn't receive items
    const distributions = await prisma.welfareDistribution.findMany({
      where: { received: false },
      select: {
        id: true,
        received: true,
        notReceivedReason: true,
        scannedAt: true,
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
        item: { select: { name: true } },
      },
      orderBy: { scannedAt: "desc" },
    });

    return NextResponse.json(distributions);
  }

  if (type === "summary") {
    // Summary of distributed items — ใช้ groupBy แทน loop query ทีละ item
    const [items, totalStudents, distributionCounts] = await Promise.all([
      prisma.welfareItem.findMany({ where: { isActive: true } }),
      prisma.student.count(),
      prisma.welfareDistribution.groupBy({
        by: ["itemId", "received"],
        _count: { id: true },
      }),
    ]);

    // สร้าง map: itemId -> { received, notReceived }
    const countMap = new Map<string, { received: number; notReceived: number }>();
    for (const row of distributionCounts) {
      const existing = countMap.get(row.itemId) || { received: 0, notReceived: 0 };
      if (row.received) {
        existing.received = row._count.id;
      } else {
        existing.notReceived = row._count.id;
      }
      countMap.set(row.itemId, existing);
    }

    const summary = items.map((item) => {
      const counts = countMap.get(item.id) || { received: 0, notReceived: 0 };
      return {
        item: item.name,
        received: counts.received,
        notReceived: counts.notReceived,
        notScanned: totalStudents - counts.received - counts.notReceived,
        total: totalStudents,
      };
    });

    return NextResponse.json(summary);
  }

  if (type === "by-level") {
    // Distribution by level — ใช้ parallel queries แทน loop
    const levels = ["ม.1", "ม.4"];

    const [totalCounts, scannedCounts] = await Promise.all([
      prisma.student.groupBy({
        by: ["level"],
        where: { level: { in: levels } },
        _count: { id: true },
      }),
      prisma.student.groupBy({
        by: ["level"],
        where: {
          level: { in: levels },
          distributions: { some: {} },
        },
        _count: { id: true },
      }),
    ]);

    const totalMap = new Map(totalCounts.map((r) => [r.level, r._count.id]));
    const scannedMap = new Map(scannedCounts.map((r) => [r.level, r._count.id]));

    const result = levels.map((level) => {
      const total = totalMap.get(level) || 0;
      const scanned = scannedMap.get(level) || 0;
      return { level, total, scanned, pending: total - scanned };
    });

    return NextResponse.json(result);
  }

  if (type === "received") {
    // นักเรียนที่รับสินค้าแล้ว — ใช้ single query (ไม่ N+1), pagination + search
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = 50;
    const skip = (page - 1) * limit;
    const search = searchParams.get("search")?.trim() || "";
    const level = searchParams.get("level") || "";
    const itemId = searchParams.get("itemId") || "";

    // สร้าง where clause แบบ dynamic
    const where: Record<string, unknown> = { received: true };

    if (itemId) {
      where.itemId = itemId;
    }

    // search + level filter ลงไปที่ student relation
    const studentWhere: Record<string, unknown> = {};
    if (level) {
      studentWhere.level = level;
    }
    if (search) {
      studentWhere.OR = [
        { studentCode: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }
    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    // ดึง count + data พร้อมกัน (parallel) เพื่อไม่ให้ server ทำงานหนัก
    const [total, distributions, items] = await Promise.all([
      prisma.welfareDistribution.count({ where }),
      prisma.welfareDistribution.findMany({
        where,
        select: {
          id: true,
          scannedAt: true,
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
          item: { select: { id: true, name: true } },
        },
        orderBy: { scannedAt: "desc" },
        skip,
        take: limit,
      }),
      // ดึงรายการสินค้าสำหรับ dropdown filter (ครั้งเดียว)
      prisma.welfareItem.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      data: distributions,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  if (type === "size-summary") {
    // Summary of pending sizes for clothing items (เสื้อ/กางเกง) that were not received
    const distributions = await prisma.welfareDistribution.findMany({
      where: {
        received: false,
        pendingSize: { not: null },
      },
      select: {
        pendingSize: true,
        item: { select: { name: true } },
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
      orderBy: [
        { item: { name: "asc" } },
        { pendingSize: "asc" },
      ],
    });

    // Group by item name -> size -> count + student list
    const grouped: Record<string, Record<string, { count: number; students: { studentCode: string; prefix: string; firstName: string; lastName: string; level: string; room: string }[] }>> = {};

    for (const d of distributions) {
      const itemName = d.item.name;
      const size = d.pendingSize!;

      if (!grouped[itemName]) grouped[itemName] = {};
      if (!grouped[itemName][size]) grouped[itemName][size] = { count: 0, students: [] };

      grouped[itemName][size].count++;
      grouped[itemName][size].students.push({
        studentCode: d.student.studentCode,
        prefix: d.student.prefix,
        firstName: d.student.firstName,
        lastName: d.student.lastName,
        level: d.student.level,
        room: d.student.room,
      });
    }

    return NextResponse.json(grouped);
  }

  return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
}
