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
  const skipItems = searchParams.get("skipItems") === "true";

  if (!barcode) {
    return NextResponse.json({ error: "กรุณาสแกน Barcode" }, { status: 400 });
  }

  // Barcode format: studentCode-receiptType
  const studentCode = barcode.split("-")[0];

  // รัน student query กับ welfare items query พร้อมกัน (ถ้าต้องการ items)
  const [student, welfareItems] = await Promise.all([
    prisma.student.findFirst({
      where: {
        OR: [
          { studentCode },
          { studentCode: barcode },
        ],
      },
      select: {
        id: true,
        studentCode: true,
        prefix: true,
        firstName: true,
        lastName: true,
        level: true,
        room: true,
        receiptType: true,
        distributions: {
          select: {
            id: true,
            itemId: true,
            received: true,
            notReceivedReason: true,
            pendingSize: true,
            item: { select: { id: true, name: true } },
          },
        },
      },
    }),
    // ข้าม welfare items query ถ้า client มี cache แล้ว — ประหยัด 1 query ต่อการสแกน
    skipItems
      ? Promise.resolve(null)
      : prisma.welfareItem.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        }),
  ]);

  if (!student) {
    return NextResponse.json(
      { error: "ไม่พบข้อมูลนักเรียน" },
      { status: 404 }
    );
  }

  const result: Record<string, unknown> = { student };
  if (welfareItems) {
    result.welfareItems = welfareItems;
  }

  return NextResponse.json(result);
}

// POST: save welfare distribution (รองรับทั้งแบบปกติและ quick-save)
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
    // ใช้ $transaction รวม upserts ทั้งหมดเป็น batch เดียว
    await prisma.$transaction(
      items.map((item: { itemId: string; received: boolean; reason?: string; pendingSize?: string }) =>
        prisma.welfareDistribution.upsert({
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
        })
      )
    );

    // Auto-mark as paid: ถ้านักเรียนมารับของที่ร้านสวัสดิการ แปลว่าชำระเงินแล้ว
    await prisma.receipt.updateMany({
      where: { studentId, paidAt: null },
      data: { paidAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Scan save error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึก" },
      { status: 500 }
    );
  }
}
