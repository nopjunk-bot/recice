import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { receiptConfigs, ReceiptTypeKey } from "@/lib/receipt-config";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !["ADMIN", "FINANCE"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { studentCode, prefix, firstName, lastName, level, room, receiptType, amount } =
      await req.json();

    // Validate required fields
    if (!studentCode || !prefix || !firstName || !lastName || !level || !room || !receiptType) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "กรุณากรอกจำนวนเงินที่ถูกต้อง" }, { status: 400 });
    }

    if (!["M1", "M4_GENERAL", "M4_ENGLISH", "M4_CHINESE", "M4_JAPANESE"].includes(receiptType)) {
      return NextResponse.json({ error: "ประเภทใบเสร็จไม่ถูกต้อง" }, { status: 400 });
    }

    // Upsert student: create if not exists, update if exists
    const student = await prisma.student.upsert({
      where: { studentCode: studentCode.trim() },
      update: {
        prefix,
        firstName,
        lastName,
        level,
        room,
        receiptType,
      },
      create: {
        studentCode: studentCode.trim(),
        prefix,
        firstName,
        lastName,
        level,
        room,
        receiptType,
      },
    });

    // Generate next receipt number
    const lastReceipt = await prisma.receipt.findFirst({
      orderBy: { receiptNumber: "desc" },
      select: { receiptNumber: true },
    });

    const counter = lastReceipt
      ? parseInt(lastReceipt.receiptNumber.split("/")[0]) + 1
      : 1;

    const receiptNumber = `${String(counter).padStart(5, "0")}/1/2569`;
    const barcodeData = `${student.studentCode}-${receiptType}`;

    // Create receipt record
    await prisma.receipt.create({
      data: {
        receiptNumber,
        studentId: student.id,
        receiptType,
        totalAmount: amount,
        barcodeData,
        generatedById: user.id,
      },
    });

    // Return data for PDF generation
    const config = receiptConfigs[receiptType as ReceiptTypeKey];

    return NextResponse.json({
      receipt: {
        student: {
          studentCode: student.studentCode,
          prefix: student.prefix,
          firstName: student.firstName,
          lastName: student.lastName,
          level: student.level,
          room: student.room,
          receiptType: student.receiptType,
        },
        receiptNumber,
        config: {
          title: config.title,
          items: [{ name: "จำนวนเงินที่ชำระ", amount }],
          total: amount,
        },
        barcodeData,
      },
    });
  } catch (error) {
    console.error("Create manual receipt error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างใบเสร็จ" },
      { status: 500 }
    );
  }
}
