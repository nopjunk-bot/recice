import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import ExcelJS from "exceljs";
import { receiptConfigs, type ReceiptTypeKey } from "@/lib/receipt-config";

const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_ENGLISH: "ม.4 อังกฤษ",
  M4_CHINESE: "ม.4 จีน",
  M4_JAPANESE: "ม.4 ญี่ปุ่น",
};

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const receiptType = searchParams.get("receiptType") || "";
  const room = searchParams.get("room") || "";

  // Build filter
  const where: Record<string, unknown> = {};
  if (receiptType) where.receiptType = receiptType;
  if (room) where.room = room;

  const students = await prisma.student.findMany({
    where,
    orderBy: [{ level: "asc" }, { room: "asc" }, { studentCode: "asc" }],
    select: {
      studentCode: true,
      prefix: true,
      firstName: true,
      lastName: true,
      level: true,
      room: true,
      receiptType: true,
    },
  });

  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();

  // Group students by room
  const grouped = new Map<string, typeof students>();
  for (const s of students) {
    const key = `${s.level}/${s.room}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  // If no grouping, create one sheet with all students
  if (grouped.size === 0) {
    const sheet = workbook.addWorksheet("รายชื่อนักเรียน");
    addEmptySheet(sheet);
  } else {
    for (const [roomKey, roomStudents] of grouped) {
      const sheetName = `ห้อง ${roomKey}`.replace(/[*?:\\/\[\]]/g, "-").substring(0, 31); // Excel sheet name max 31 chars
      const sheet = workbook.addWorksheet(sheetName);
      fillSheet(sheet, roomKey, roomStudents);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();

  // Build filename
  let filename = "รายชื่อนักเรียน";
  if (receiptType) filename += `_${receiptTypeLabels[receiptType] || receiptType}`;
  if (room) filename += `_ห้อง${room}`;
  filename += ".xlsx";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

function addEmptySheet(sheet: ExcelJS.Worksheet) {
  sheet.addRow(["ไม่พบข้อมูลนักเรียน"]);
}

function fillSheet(
  sheet: ExcelJS.Worksheet,
  roomKey: string,
  students: {
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    level: string;
    room: string;
    receiptType: string;
  }[]
) {
  // Determine receipt type label and amount
  const firstStudent = students[0];
  const typeKey = firstStudent.receiptType as ReceiptTypeKey;
  const config = receiptConfigs[typeKey];
  const typeLabel = receiptTypeLabels[firstStudent.receiptType] || firstStudent.receiptType;

  // Title row
  const titleRow = sheet.addRow([`รายชื่อนักเรียนห้อง ${roomKey} (${typeLabel})`]);
  titleRow.font = { name: "TH SarabunPSK", size: 16, bold: true };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 6);
  titleRow.alignment = { horizontal: "center" };

  // Subtitle with total amount
  if (config) {
    const subtitleRow = sheet.addRow([`จำนวนเงิน ${config.total.toLocaleString()} บาท/คน`]);
    subtitleRow.font = { name: "TH SarabunPSK", size: 14 };
    sheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, 6);
    subtitleRow.alignment = { horizontal: "center" };
  }

  // Empty row
  sheet.addRow([]);

  // Header row
  const headerRow = sheet.addRow([
    "ลำดับ",
    "รหัส",
    "ชื่อ-สกุล",
    "ห้อง",
    "จำนวนเงิน",
    "ลงชื่อผู้ปกครอง",
  ]);
  headerRow.font = { name: "TH SarabunPSK", size: 14, bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };
  });

  // Data rows
  students.forEach((s, index) => {
    const amount = config ? config.total : "";
    const row = sheet.addRow([
      index + 1,
      s.studentCode,
      `${s.prefix}${s.firstName} ${s.lastName}`,
      `${s.level}/${s.room}`,
      amount,
      "", // Signature column - left blank for signing
    ]);
    row.font = { name: "TH SarabunPSK", size: 14 };
    row.height = 22;

    // Center align specific columns
    row.getCell(1).alignment = { horizontal: "center" }; // ลำดับ
    row.getCell(2).alignment = { horizontal: "center" }; // รหัส
    row.getCell(4).alignment = { horizontal: "center" }; // ห้อง
    row.getCell(5).alignment = { horizontal: "center" }; // จำนวนเงิน
    row.getCell(5).numFmt = "#,##0";

    // Borders for all cells
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= 6) {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    });
  });

  // Summary row
  sheet.addRow([]);
  const summaryRow = sheet.addRow([`รวมทั้งสิ้น ${students.length} คน`]);
  summaryRow.font = { name: "TH SarabunPSK", size: 14, bold: true };

  // Set column widths
  sheet.getColumn(1).width = 8;   // ลำดับ
  sheet.getColumn(2).width = 15;  // รหัส
  sheet.getColumn(3).width = 35;  // ชื่อ-สกุล
  sheet.getColumn(4).width = 12;  // ห้อง
  sheet.getColumn(5).width = 15;  // จำนวนเงิน
  sheet.getColumn(6).width = 25;  // ลงชื่อผู้ปกครอง
}
