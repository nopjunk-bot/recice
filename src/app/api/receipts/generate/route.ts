import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { receiptConfigs, ReceiptTypeKey } from "@/lib/receipt-config";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { studentIds } = await req.json();

    if (!studentIds || studentIds.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเลือกนักเรียน" },
        { status: 400 }
      );
    }

    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      orderBy: { studentCode: "asc" },
    });

    // Generate receipt numbers and save
    const lastReceipt = await prisma.receipt.findFirst({
      orderBy: { receiptNumber: "desc" },
    });

    let counter = lastReceipt
      ? parseInt(lastReceipt.receiptNumber.split("/")[0]) + 1
      : 1;

    const receiptsData = [];

    for (const student of students) {
      // Check if receipt already exists
      const existing = await prisma.receipt.findFirst({
        where: { studentId: student.id },
      });

      if (existing) {
        receiptsData.push({
          student,
          receiptNumber: existing.receiptNumber,
          config: receiptConfigs[student.receiptType as ReceiptTypeKey],
          barcodeData: existing.barcodeData,
        });
        continue;
      }

      const receiptNumber = `${String(counter).padStart(5, "0")}/1/2569`;
      const barcodeData = `${student.studentCode}-${student.receiptType}`;

      await prisma.receipt.create({
        data: {
          receiptNumber,
          studentId: student.id,
          receiptType: student.receiptType,
          totalAmount:
            receiptConfigs[student.receiptType as ReceiptTypeKey].total,
          barcodeData,
          generatedById: user.id,
        },
      });

      receiptsData.push({
        student,
        receiptNumber,
        config: receiptConfigs[student.receiptType as ReceiptTypeKey],
        barcodeData,
      });

      counter++;
    }

    return NextResponse.json({ receipts: receiptsData });
  } catch (error) {
    console.error("Generate receipt error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างใบเสร็จ" },
      { status: 500 }
    );
  }
}
