import jsPDF from "jspdf";
import { THSarabunNew } from "./thsarabun-font";
import { receiptConfigs, type ReceiptTypeKey } from "./receipt-config";

const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_ENGLISH: "ม.4 อังกฤษ",
  M4_CHINESE: "ม.4 จีน",
  M4_JAPANESE: "ม.4 ญี่ปุ่น",
};

type StudentData = {
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
  receiptType: string;
};

function registerFont(doc: jsPDF) {
  doc.addFileToVFS("THSarabunNew.ttf", THSarabunNew);
  doc.addFont("THSarabunNew.ttf", "THSarabunNew", "normal");
  doc.setFont("THSarabunNew");
}

function drawPage(
  doc: jsPDF,
  roomKey: string,
  typeLabel: string,
  totalAmount: number | null,
  students: StudentData[],
  startIndex: number,
  count: number
) {
  const pageW = 210;
  const marginL = 15;
  const marginR = 15;
  const tableW = pageW - marginL - marginR;

  // Column widths
  const colWidths = [12, 25, 60, 22, 25, 36]; // ลำดับ, รหัส, ชื่อ-สกุล, ห้อง, จำนวนเงิน, ลงชื่อผู้ปกครอง

  doc.setFont("THSarabunNew", "normal");
  doc.setTextColor(0, 0, 0);

  // Title
  let y = 20;
  doc.setFontSize(18);
  doc.text(`รายชื่อนักเรียนห้อง ${roomKey} (${typeLabel})`, pageW / 2, y, {
    align: "center",
  });

  // Subtitle - amount per person
  if (totalAmount) {
    y += 8;
    doc.setFontSize(16);
    doc.text(
      `จำนวนเงิน ${totalAmount.toLocaleString()} บาท/คน`,
      pageW / 2,
      y,
      { align: "center" }
    );
  }

  // Table header
  y += 10;
  const headerH = 10;
  const headers = ["ลำดับ", "รหัส", "ชื่อ-สกุล", "ห้อง", "จำนวนเงิน", "ลงชื่อ\nผู้ปกครอง"];

  doc.setFontSize(14);
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);

  // Draw header cells with background
  let x = marginL;
  for (let i = 0; i < headers.length; i++) {
    doc.setFillColor(217, 225, 242); // light blue
    doc.rect(x, y, colWidths[i], headerH, "FD");

    // Split header text for multi-line (ลงชื่อ\nผู้ปกครอง)
    const lines = headers[i].split("\n");
    if (lines.length === 1) {
      doc.text(lines[0], x + colWidths[i] / 2, y + 7, { align: "center" });
    } else {
      doc.setFontSize(12);
      doc.text(lines[0], x + colWidths[i] / 2, y + 4.5, { align: "center" });
      doc.text(lines[1], x + colWidths[i] / 2, y + 8.5, { align: "center" });
      doc.setFontSize(14);
    }
    x += colWidths[i];
  }

  y += headerH;

  // Data rows
  const rowH = 8;
  doc.setFontSize(14);

  for (let i = 0; i < count; i++) {
    const s = students[startIndex + i];
    const fullName = `${s.prefix}${s.firstName} ${s.lastName}`;
    const roomText = `${s.level}/${s.room}`;
    const amount = totalAmount ? totalAmount.toLocaleString() : "";

    x = marginL;

    // Draw cells
    for (let c = 0; c < colWidths.length; c++) {
      doc.rect(x, y, colWidths[c], rowH);
      x += colWidths[c];
    }

    x = marginL;

    // ลำดับ (center)
    doc.text(String(startIndex + i + 1), x + colWidths[0] / 2, y + 5.5, {
      align: "center",
    });
    x += colWidths[0];

    // รหัส (center)
    doc.text(s.studentCode, x + colWidths[1] / 2, y + 5.5, {
      align: "center",
    });
    x += colWidths[1];

    // ชื่อ-สกุล (left with padding)
    doc.text(fullName, x + 2, y + 5.5);
    x += colWidths[2];

    // ห้อง (center)
    doc.text(roomText, x + colWidths[3] / 2, y + 5.5, { align: "center" });
    x += colWidths[3];

    // จำนวนเงิน (center)
    doc.text(amount, x + colWidths[4] / 2, y + 5.5, { align: "center" });
    x += colWidths[4];

    // ลงชื่อผู้ปกครอง (empty - for signing)

    y += rowH;
  }

  // Summary
  y += 5;
  doc.setFontSize(14);
  doc.text(
    `รวมทั้งสิ้น ${students.length} คน`,
    marginL,
    y
  );

  return y;
}

export function generateStudentListPDF(students: StudentData[]) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  registerFont(doc);

  // Group students by room
  const grouped = new Map<string, StudentData[]>();
  for (const s of students) {
    const key = `${s.level}/${s.room}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  if (grouped.size === 0) {
    doc.setFontSize(16);
    doc.text("ไม่พบข้อมูลนักเรียน", 105, 50, { align: "center" });
    doc.save("รายชื่อนักเรียน.pdf");
    return;
  }

  let isFirstPage = true;
  const maxRowsFirstPage = 27; // rows that fit on first page (with title)
  const maxRowsNextPage = 30; // rows on continuation pages

  for (const [roomKey, roomStudents] of grouped) {
    const firstStudent = roomStudents[0];
    const typeKey = firstStudent.receiptType as ReceiptTypeKey;
    const config = receiptConfigs[typeKey];
    const typeLabel =
      receiptTypeLabels[firstStudent.receiptType] || firstStudent.receiptType;
    const totalAmount = config ? config.total : null;

    let offset = 0;
    let pageIndex = 0;

    while (offset < roomStudents.length) {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      const maxRows = pageIndex === 0 ? maxRowsFirstPage : maxRowsNextPage;
      const count = Math.min(maxRows, roomStudents.length - offset);

      drawPage(
        doc,
        roomKey,
        typeLabel,
        totalAmount,
        roomStudents,
        offset,
        count
      );

      offset += count;
      pageIndex++;
    }
  }

  doc.save("รายชื่อนักเรียน.pdf");
}
