import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET: lookup student by barcode
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
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
      OR: [
        { studentCode },
        { studentCode: barcode },
      ],
    },
    include: {
      distributions: {
        include: { item: true },
      },
    },
  });

  if (!student) {
    return NextResponse.json(
      { error: "ไม่พบข้อมูลนักเรียน" },
      { status: 404 }
    );
  }

  // Get welfare items
  const welfareItems = await prisma.welfareItem.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ student, welfareItems });
}

// POST: save welfare distribution
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { studentId, items } = await req.json();

    if (!studentId || !items) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    // items: [{ itemId: string, received: boolean, reason?: string, pendingSize?: string }]
    for (const item of items) {
      await prisma.welfareDistribution.upsert({
        where: {
          studentId_itemId: {
            studentId,
            itemId: item.itemId,
          },
        },
        update: {
          received: item.received,
          notReceivedReason: item.reason || null,
          pendingSize: item.received ? null : (item.pendingSize || null),
          scannedById: user.id,
          scannedAt: new Date(),
        },
        create: {
          studentId,
          itemId: item.itemId,
          received: item.received,
          notReceivedReason: item.reason || null,
          pendingSize: item.received ? null : (item.pendingSize || null),
          scannedById: user.id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Scan save error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึก" },
      { status: 500 }
    );
  }
}
