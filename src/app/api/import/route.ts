import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import ExcelJS from "exceljs";
import type { ReceiptTypeKey } from "@/lib/receipt-config";

const m4SheetMap: Record<string, ReceiptTypeKey> = {
  "ทั่วไป": "M4_GENERAL",
  "อังกฤษ": "M4_ENGLISH",
  "จีน": "M4_CHINESE",
  "ญี่ปุ่น": "M4_JAPANESE",
};

const validReceiptTypes: ReceiptTypeKey[] = ["M1", "M4_GENERAL", "M4_ENGLISH", "M4_CHINESE", "M4_JAPANESE"];

type StudentRow = {
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
  receiptType: ReceiptTypeKey;
};

// Template ม.4 มี 10 คอลัมน์: เลขที่ใบสมัคร(1), เลขประจำตัว(2), คำนำหน้า(3), ชื่อ(4), นามสกุล(5), แผนการเรียน(6), ประเภท(7), ชั้น(8), ห้อง(9), หมายเหตุ(10)
// Template ม.1 มี 6 คอลัมน์: เลขประจำตัว(1), คำนำหน้า(2), ชื่อ(3), นามสกุล(4), ชั้น(5), ห้อง(6)

function parseM4Sheet(worksheet: ExcelJS.Worksheet, receiptType: ReceiptTypeKey): StudentRow[] {
  const rows: StudentRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const studentCode = String(row.getCell(2).value || "").trim();
    const prefix = String(row.getCell(3).value || "").trim();
    const firstName = String(row.getCell(4).value || "").trim();
    const lastName = String(row.getCell(5).value || "").trim();
    const level = String(row.getCell(8).value || "").trim();
    const room = String(row.getCell(9).value || "").trim();

    if (studentCode && firstName && lastName) {
      rows.push({ studentCode, prefix, firstName, lastName, level, room, receiptType });
    }
  });
  return rows;
}

function parseM1Sheet(worksheet: ExcelJS.Worksheet, receiptType: ReceiptTypeKey): StudentRow[] {
  const rows: StudentRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const studentCode = String(row.getCell(1).value || "").trim();
    const prefix = String(row.getCell(2).value || "").trim();
    const firstName = String(row.getCell(3).value || "").trim();
    const lastName = String(row.getCell(4).value || "").trim();
    const level = String(row.getCell(5).value || "").trim();
    const room = String(row.getCell(6).value || "").trim();

    if (studentCode && firstName && lastName) {
      rows.push({ studentCode, prefix, firstName, lastName, level, room, receiptType });
    }
  });
  return rows;
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const receiptType = formData.get("receiptType") as string;

    if (!file) {
      return NextResponse.json(
        { error: "กรุณาเลือกไฟล์" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer as ExcelJS.Buffer);

    let students: StudentRow[] = [];

    // ตรวจว่าเป็นไฟล์ multi-sheet ม.4 หรือไม่ (มี sheet ชื่อ ทั่วไป/อังกฤษ/จีน/ญี่ปุ่น)
    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    const matchedM4Sheets = sheetNames.filter((name) => name in m4SheetMap);

    if (matchedM4Sheets.length > 0) {
      // โหมด multi-sheet: อ่านทุก sheet ที่ตรงกับ m4SheetMap
      for (const sheetName of matchedM4Sheets) {
        const worksheet = workbook.getWorksheet(sheetName);
        if (worksheet) {
          const type = m4SheetMap[sheetName];
          students.push(...parseM4Sheet(worksheet, type));
        }
      }
    } else {
      // โหมดปกติ: ใช้ receiptType จาก form
      if (!receiptType || !validReceiptTypes.includes(receiptType as ReceiptTypeKey)) {
        return NextResponse.json(
          { error: "กรุณาเลือกประเภทใบเสร็จ" },
          { status: 400 }
        );
      }

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return NextResponse.json(
          { error: "ไม่พบข้อมูลในไฟล์ Excel" },
          { status: 400 }
        );
      }

      students = parseM1Sheet(worksheet, receiptType as ReceiptTypeKey);
    }

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

    // Create students (batch insert)
    await prisma.student.createMany({
      data: newStudents.map((student) => ({
        studentCode: student.studentCode,
        prefix: student.prefix,
        firstName: student.firstName,
        lastName: student.lastName,
        level: student.level,
        room: student.room,
        receiptType: student.receiptType,
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
