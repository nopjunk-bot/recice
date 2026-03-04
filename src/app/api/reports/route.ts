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

  return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
}
