import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// API ทดสอบ — ข้ามการตรวจสอบช่วงเวลา ใช้รอบที่ 1 เป็นค่าเริ่มต้น

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

function formatThaiDate(date: Date): string {
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
    "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
    "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear() + 543;
  return `${d} ${m} ${y}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentCode, receiptNumber, studentName } = body;

    if (!studentCode || !receiptNumber || !studentName) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" },
        { status: 400 }
      );
    }

    // ข้ามการตรวจสอบช่วงเวลา — ใช้รอบที่ 1 เป็นค่าเริ่มต้น
    const testRound = 1;

    // ตรวจสอบหมายเลขนักเรียน
    const student = await prisma.student.findUnique({
      where: { studentCode: studentCode.trim() },
    });

    if (!student) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลนักเรียนด้วยหมายเลขประจำตัวนี้" },
        { status: 400 }
      );
    }

    // ตรวจสอบชื่อนักเรียนตรงกับฐานข้อมูล (ไม่รวมคำนำหน้า)
    const dbFullName = `${student.firstName} ${student.lastName}`.trim();
    if (studentName.trim() !== dbFullName) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูล ชื่อนักเรียนไม่ตรงกับข้อมูลในระบบ" },
        { status: 400 }
      );
    }

    // ตรวจสอบเลขที่ใบเสร็จ
    const receipt = await prisma.receipt.findUnique({
      where: { receiptNumber: receiptNumber.trim() },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: "ไม่พบใบเสร็จเลขที่นี้ในระบบ" },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าใบเสร็จตรงกับนักเรียน
    if (receipt.studentId !== student.id) {
      return NextResponse.json(
        { error: "ใบเสร็จเลขที่นี้ไม่ตรงกับหมายเลขนักเรียนที่ระบุ" },
        { status: 400 }
      );
    }

    // ตรวจสอบว่านักเรียนได้รับสินค้าแล้ว (ยืนยันการชำระเงิน)
    const distribution = await prisma.welfareDistribution.findFirst({
      where: {
        studentId: student.id,
        received: true,
      },
    });

    if (!distribution) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลการรับสินค้า ใบเสร็จนี้ยังไม่ได้ชำระหรือยังไม่ได้รับสินค้า" },
        { status: 400 }
      );
    }

    // คำนวณวันรับเอกสาร (3 วันทำการ)
    const now = new Date();
    const pickupDate = addBusinessDays(now, 3);

    // สร้างคำขอ (upsert ป้องกันซ้ำ)
    const docRequest = await prisma.documentRequest.upsert({
      where: {
        studentId_receiptId: {
          studentId: student.id,
          receiptId: receipt.id,
        },
      },
      update: {
        studentName: studentName.trim(),
        requestRound: testRound,
        status: "PENDING",
        pickupDate,
      },
      create: {
        studentId: student.id,
        receiptId: receipt.id,
        studentName: studentName.trim(),
        requestRound: testRound,
        status: "PENDING",
        pickupDate,
      },
    });

    return NextResponse.json({
      success: true,
      request: {
        id: docRequest.id,
        studentCode: student.studentCode,
        studentFullName: `${student.prefix}${student.firstName} ${student.lastName}`,
        receiptNumber: receipt.receiptNumber,
        round: testRound,
        pickupDate: formatThaiDate(pickupDate),
      },
    });
  } catch (error) {
    console.error("Test document request error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
