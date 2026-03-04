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
      include: {
        student: true,
        item: true,
      },
      orderBy: { scannedAt: "desc" },
    });

    return NextResponse.json(distributions);
  }

  if (type === "summary") {
    // Summary of distributed items
    const items = await prisma.welfareItem.findMany({
      where: { isActive: true },
    });

    const summary = [];
    for (const item of items) {
      const received = await prisma.welfareDistribution.count({
        where: { itemId: item.id, received: true },
      });
      const notReceived = await prisma.welfareDistribution.count({
        where: { itemId: item.id, received: false },
      });
      const totalStudents = await prisma.student.count();

      summary.push({
        item: item.name,
        received,
        notReceived,
        notScanned: totalStudents - received - notReceived,
        total: totalStudents,
      });
    }

    return NextResponse.json(summary);
  }

  if (type === "by-level") {
    // Distribution by level
    const levels = ["ม.1", "ม.4"];
    const result = [];

    for (const level of levels) {
      const totalStudents = await prisma.student.count({
        where: { level },
      });
      const scannedStudents = await prisma.student.count({
        where: {
          level,
          distributions: { some: {} },
        },
      });

      result.push({
        level,
        total: totalStudents,
        scanned: scannedStudents,
        pending: totalStudents - scannedStudents,
      });
    }

    return NextResponse.json(result);
  }

  if (type === "size-summary") {
    // Summary of pending sizes for clothing items (เสื้อ/กางเกง) that were not received
    const distributions = await prisma.welfareDistribution.findMany({
      where: {
        received: false,
        pendingSize: { not: null },
      },
      include: {
        item: true,
        student: true,
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
