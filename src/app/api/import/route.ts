import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import ExcelJS from "exceljs";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const receiptType = formData.get("receiptType") as string;

    if (!file || !receiptType) {
      return NextResponse.json(
        { error: "กรุณาเลือกไฟล์และประเภทใบเสร็จ" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer as ExcelJS.Buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลในไฟล์ Excel" },
        { status: 400 }
      );
    }

    const students: {
      studentCode: string;
      prefix: string;
      firstName: string;
      lastName: string;
      level: string;
      room: string;
    }[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      const studentCode = String(row.getCell(1).value || "").trim();
      const prefix = String(row.getCell(2).value || "").trim();
      const firstName = String(row.getCell(3).value || "").trim();
      const lastName = String(row.getCell(4).value || "").trim();
      const level = String(row.getCell(5).value || "").trim();
      const room = String(row.getCell(6).value || "").trim();

      if (studentCode && firstName && lastName) {
        students.push({ studentCode, prefix, firstName, lastName, level, room });
      }
    });

    if (students.length === 0) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลนักเรียนในไฟล์" },
        { status: 400 }
      );
    }

    // Check for duplicates
    const existingCodes = await prisma.student.findMany({
      where: {
        studentCode: { in: students.map((s) => s.studentCode) },
      },
      select: { studentCode: true },
    });
    const existingSet = new Set(existingCodes.map((s) => s.studentCode));
    const newStudents = students.filter((s) => !existingSet.has(s.studentCode));
    const duplicates = students.filter((s) => existingSet.has(s.studentCode));

    if (newStudents.length === 0) {
      return NextResponse.json(
        { error: "นักเรียนทั้งหมดมีอยู่ในระบบแล้ว", duplicates },
        { status: 400 }
      );
    }

    // Create import batch
    const batch = await prisma.importBatch.create({
      data: {
        fileName: file.name,
        importedById: user.id,
        totalStudents: newStudents.length,
      },
    });

    // Create students (batch insert — 1 query แทน N queries)
    await prisma.student.createMany({
      data: newStudents.map((student) => ({
        ...student,
        receiptType: receiptType as "M1" | "M4_GENERAL" | "M4_LANG",
        importBatchId: batch.id,
      })),
    });

    return NextResponse.json({
      success: true,
      imported: newStudents.length,
      duplicates: duplicates.length,
      batchId: batch.id,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}
