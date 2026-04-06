import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import ExcelJS from "exceljs";

const ACADEMIC_COOKIE = "academic_session";

// ดึงระดับชั้น (ม.1, ม.4) จากค่า level
function getGradeLevel(level: string): string {
  const trimmed = level.trim();
  const match = trimmed.match(/(\d+)/);
  if (match) return `ม.${match[1]}`;
  return trimmed || "ไม่ระบุ";
}

const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_ENGLISH: "ม.4 อังกฤษ",
  M4_CHINESE: "ม.4 จีน",
  M4_JAPANESE: "ม.4 ญี่ปุ่น",
};

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // ตรวจ main session (ADMIN / FINANCE)
  const user = await getSession();
  if (user && ["ADMIN", "FINANCE"].includes(user.role)) return true;

  // ตรวจ academic session
  const academicCookie = req.cookies.get(ACADEMIC_COOKIE);
  if (academicCookie?.value === "authenticated") return true;

  // ตรวจ main session cookie สำหรับ ACADEMIC role
  const mainSession = req.cookies.get("session");
  if (mainSession) {
    try {
      const data = JSON.parse(Buffer.from(mainSession.value, "base64").toString());
      if (data.role === "ACADEMIC" || data.role === "ADMIN") return true;
    } catch { /* invalid */ }
  }

  return false;
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // นักเรียนที่ Admin ยืนยันค้างชำระ
  const students = await prisma.student.findMany({
    where: {
      receipts: {
        some: { paidAt: null, unpaidConfirmedAt: { not: null } },
      },
    },
    select: {
      studentCode: true,
      prefix: true,
      firstName: true,
      lastName: true,
      level: true,
      room: true,
      receiptType: true,
      receipts: {
        where: { paidAt: null, unpaidConfirmedAt: { not: null } },
        select: {
          receiptNumber: true,
          totalAmount: true,
          unpaidConfirmedAt: true,
        },
        take: 1,
      },
    },
    orderBy: [{ level: "asc" }, { room: "asc" }, { studentCode: "asc" }],
  });

  // แบ่งกลุ่มตามระดับชั้น
  const grouped = new Map<string, typeof students>();
  for (const s of students) {
    const grade = getGradeLevel(s.level);
    if (!grouped.has(grade)) grouped.set(grade, []);
    grouped.get(grade)!.push(s);
  }

  const workbook = new ExcelJS.Workbook();

  if (grouped.size === 0) {
    const sheet = workbook.addWorksheet("ไม่มีข้อมูล");
    sheet.addRow(["ไม่มีนักเรียนที่ Admin ยืนยันค้างชำระ"]);
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
  const filename = `รายงานนักเรียนค้างชำระที่ Admin ยืนยัน.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

type StudentRow = {
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
  receiptType: string;
  receipts: {
    receiptNumber: string;
    totalAmount: number;
    unpaidConfirmedAt: Date | null;
  }[];
};

function fillSheet(sheet: ExcelJS.Worksheet, grade: string, students: StudentRow[]) {
  // Title
  const titleRow = sheet.addRow([`รายชื่อนักเรียนที่ Admin ยืนยันค้างชำระ - ${grade}`]);
  titleRow.font = { name: "TH SarabunPSK", size: 16, bold: true };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 8);
  titleRow.alignment = { horizontal: "center" };

  const totalAmount = students.reduce((sum, s) => sum + (s.receipts[0]?.totalAmount || 0), 0);
  const subtitleRow = sheet.addRow([`รวมทั้งสิ้น ${students.length} คน | ยอดค้างชำระรวม ${totalAmount.toLocaleString()} บาท`]);
  subtitleRow.font = { name: "TH SarabunPSK", size: 14 };
  sheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, 8);
  subtitleRow.alignment = { horizontal: "center" };

  sheet.addRow([]);

  // Header
  const headers = ["ลำดับ", "เลขประจำตัว", "ชื่อ-นามสกุล", "ชั้น/ห้อง", "ประเภท", "จำนวนเงิน (บาท)", "วันที่ยืนยัน", "หมายเหตุ"];
  const headerRow = sheet.addRow(headers);
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
      fgColor: { argb: "FFFCE4EC" }, // สีชมพูอ่อน
    };
  });

  // Data
  students.forEach((s, i) => {
    const receipt = s.receipts[0];
    const confirmedDate = receipt?.unpaidConfirmedAt
      ? new Date(receipt.unpaidConfirmedAt).toLocaleDateString("th-TH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "-";

    const row = sheet.addRow([
      i + 1,
      s.studentCode,
      `${s.prefix}${s.firstName} ${s.lastName}`,
      `${s.level}/${s.room}`,
      receiptTypeLabels[s.receiptType] || s.receiptType,
      receipt?.totalAmount || 0,
      confirmedDate,
      "", // ช่องหมายเหตุ (ว่างไว้ให้กรอก)
    ]);
    row.font = { name: "TH SarabunPSK", size: 14 };
    row.height = 22;

    // Alignment
    row.getCell(1).alignment = { horizontal: "center" }; // ลำดับ
    row.getCell(2).alignment = { horizontal: "center" }; // เลขประจำตัว
    row.getCell(4).alignment = { horizontal: "center" }; // ชั้น/ห้อง
    row.getCell(5).alignment = { horizontal: "center" }; // ประเภท
    row.getCell(6).alignment = { horizontal: "right" };  // จำนวนเงิน
    row.getCell(6).numFmt = '#,##0';
    row.getCell(7).alignment = { horizontal: "center" }; // วันที่ยืนยัน

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= 8) {
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
  sheet.getColumn(1).width = 8;   // ลำดับ
  sheet.getColumn(2).width = 15;  // เลขประจำตัว
  sheet.getColumn(3).width = 35;  // ชื่อ-นามสกุล
  sheet.getColumn(4).width = 12;  // ชั้น/ห้อง
  sheet.getColumn(5).width = 16;  // ประเภท
  sheet.getColumn(6).width = 18;  // จำนวนเงิน
  sheet.getColumn(7).width = 18;  // วันที่ยืนยัน
  sheet.getColumn(8).width = 30;  // หมายเหตุ
}
