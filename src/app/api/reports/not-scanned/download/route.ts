import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import ExcelJS from "exceljs";

// ดึงระดับชั้น (ม.1, ม.4) จากค่า level เช่น "1" → "ม.1", "ม.4" → "ม.4"
function getGradeLevel(level: string): string {
  const trimmed = level.trim();
  const match = trimmed.match(/(\d+)/);
  if (match) return `ม.${match[1]}`;
  return trimmed || "ไม่ระบุ";
}

export async function GET(_req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // นักเรียนที่ยังไม่ได้สแกนรับสินค้าเลย
  const students = await prisma.student.findMany({
    where: { distributions: { none: {} } },
    select: {
      studentCode: true,
      prefix: true,
      firstName: true,
      lastName: true,
      level: true,
      room: true,
    },
    orderBy: [{ level: "asc" }, { room: "asc" }, { studentCode: "asc" }],
  });

  // แบ่งกลุ่มตามระดับชั้น (ม.1, ม.4, ...)
  const grouped = new Map<string, typeof students>();
  for (const s of students) {
    const grade = getGradeLevel(s.level);
    if (!grouped.has(grade)) grouped.set(grade, []);
    grouped.get(grade)!.push(s);
  }

  const workbook = new ExcelJS.Workbook();

  if (grouped.size === 0) {
    const sheet = workbook.addWorksheet("ไม่มีข้อมูล");
    sheet.addRow(["ไม่มีนักเรียนที่ยังไม่ได้สแกน"]);
  } else {
    const sortedGrades = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
    for (const grade of sortedGrades) {
      const list = grouped.get(grade)!;
      const sheetName = grade.replace(/[*?:\\/\[\]]/g, "-").substring(0, 31);
      const sheet = workbook.addWorksheet(sheetName);
      fillSheet(sheet, grade, list);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `นักเรียนยังไม่สแกนรับสินค้า.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

function fillSheet(
  sheet: ExcelJS.Worksheet,
  grade: string,
  students: {
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    level: string;
    room: string;
  }[]
) {
  // Title
  const titleRow = sheet.addRow([`รายชื่อนักเรียนที่ยังไม่ได้สแกนรับสินค้า - ${grade}`]);
  titleRow.font = { name: "TH SarabunPSK", size: 16, bold: true };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 5);
  titleRow.alignment = { horizontal: "center" };

  const subtitleRow = sheet.addRow([`รวมทั้งสิ้น ${students.length} คน`]);
  subtitleRow.font = { name: "TH SarabunPSK", size: 14 };
  sheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, 5);
  subtitleRow.alignment = { horizontal: "center" };

  sheet.addRow([]);

  // Header
  const headerRow = sheet.addRow(["ลำดับ", "เลขประจำตัว", "ชื่อ-นามสกุล", "ชั้น", "ห้อง"]);
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

  // Data
  students.forEach((s, i) => {
    const row = sheet.addRow([
      i + 1,
      s.studentCode,
      `${s.prefix}${s.firstName} ${s.lastName}`,
      s.level,
      s.room,
    ]);
    row.font = { name: "TH SarabunPSK", size: 14 };
    row.height = 22;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(4).alignment = { horizontal: "center" };
    row.getCell(5).alignment = { horizontal: "center" };
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= 5) {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    });
  });

  // Column widths
  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 40;
  sheet.getColumn(4).width = 10;
  sheet.getColumn(5).width = 10;
}
