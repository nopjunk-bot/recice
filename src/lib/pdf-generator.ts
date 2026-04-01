import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JsBarcode from "jsbarcode";
import THBText from "thai-baht-text";
import { THSarabunNew } from "./thsarabun-font";
import { logo1Base64, logo2Base64 } from "./logos";

type ReceiptData = {
  student: {
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    level: string;
    room: string;
    receiptType: string;
  };
  receiptNumber: string;
  config: {
    title: string;
    items: { name: string; amount: number }[];
    total: number;
  };
  barcodeData: string;
};

// Register TH Sarabun New font into jsPDF
function registerFont(doc: jsPDF) {
  doc.addFileToVFS("THSarabunNew.ttf", THSarabunNew);
  doc.addFont("THSarabunNew.ttf", "THSarabunNew", "normal");
  doc.setFont("THSarabunNew");
}

// Format date string (YYYY-MM-DD) to Thai date text
function formatThaiDate(dateStr: string): string {
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const [year, month, day] = dateStr.split("-").map(Number);
  const thaiYear = year + 543;
  const dayNum = day;
  const monthName = thaiMonths[month - 1];
  return `วันที่  ${dayNum}  เดือน  ${monthName}  พ.ศ. ${thaiYear}`;
}

// Draw a single receipt in A5 half (A4 Landscape = 297x210, each half = 148.5x210)
function drawReceipt(doc: jsPDF, receipt: ReceiptData, offsetX: number, dateText: string, copyLabel: string = "(สำหรับนักเรียน)") {
  const W = 148.5; // half width
  const cx = offsetX + W / 2;
  const margin = 12;

  doc.setFont("THSarabunNew", "normal");
  doc.setTextColor(0, 0, 0);

  // ========== Barcode (top-left corner) ==========
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, receipt.barcodeData, {
    format: "CODE128",
    width: 1.5,
    height: 35,
    displayValue: true,
    fontSize: 14,
    fontOptions: "bold",
    margin: 2,
    font: "monospace",
    textMargin: 1,
  });
  const barcodeImg = canvas.toDataURL("image/png");
  doc.addImage(barcodeImg, "PNG", offsetX + 5, 5, 42, 18);

  // ========== Receipt Number (top-right) ==========
  doc.setFontSize(16);
  const numText = `เลขที่ ${receipt.receiptNumber}`;
  doc.text(numText, offsetX + W - margin, 13, { align: "right" });
  // Underline the receipt number
  const numWidth = doc.getTextWidth(receipt.receiptNumber);
  const numEndX = offsetX + W - margin;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(numEndX - numWidth - 1, 14, numEndX, 14);

  // ป้ายกำกับสำเนา (ซ้าย=เจ้าหน้าที่ / ขวา=นักเรียน)
  doc.setFontSize(14);
  doc.text(copyLabel, offsetX + W - margin, 20, {
    align: "right",
  });

  // ========== Logos (centered, between barcode and title) ==========
  const logoSize = 14; // mm
  const logoGap = 3;
  const logoTotalW = logoSize * 2 + logoGap;
  const logoStartX = cx - logoTotalW / 2;
  const logoY = 20;
  doc.addImage(logo1Base64, "PNG", logoStartX, logoY, logoSize, logoSize);
  doc.addImage(logo2Base64, "PNG", logoStartX + logoSize + logoGap, logoY, logoSize, logoSize);

  // ========== Title (bold, centered) ==========
  let y = 37;
  doc.setFontSize(18);
  doc.text(receipt.config.title, cx, y, { align: "center" });

  // ========== Address ==========
  y += 8;
  doc.setFontSize(16);
  doc.text(
    "498 ตำบลเนินพระ  อำเภอเมืองระยอง  จังหวัดระยอง",
    cx,
    y,
    { align: "center" }
  );

  // ========== Date ==========
  y += 7;
  doc.text(dateText, cx, y, {
    align: "center",
  });

  // ========== Name line ==========
  y += 9;
  const fullName = `${receipt.student.prefix}${receipt.student.firstName} ${receipt.student.lastName}`;
  const classText = `ชั้น ${receipt.student.level}/${receipt.student.room}`;

  doc.setFontSize(16);
  const label = "ได้รับเงินจาก";
  doc.text(label, offsetX + margin, y);
  const afterLabel = offsetX + margin + doc.getTextWidth(label);

  // Print student name
  const nameX = afterLabel + 1;
  doc.text(fullName, nameX, y);

  // Print class on the right
  const classX = offsetX + W - margin - doc.getTextWidth(classText);
  doc.text(classText, classX, y);

  // Draw dotted line between name and class
  doc.setLineWidth(0.15);
  const dotsStart = nameX + doc.getTextWidth(fullName) + 1;
  const dotsEnd = classX - 2;
  for (let dx = dotsStart; dx < dotsEnd; dx += 1.8) {
    doc.circle(dx, y + 0.5, 0.18, "F");
  }

  // ========== Table ==========
  y += 6;
  const tblX = offsetX + margin;
  const tblW = W - margin * 2;

  // Column widths: ที่ | รายการ | บาท | สต.
  const col1 = 10;  // "ที่"
  const col4 = 10;  // "สต."
  const col3 = 20;  // "บาท"
  const col2 = tblW - col1 - col3 - col4; // "รายการ"

  const headerH = 12;
  const rowH = 8;

  doc.setFontSize(15);
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);

  // --- Header: "ที่" cell ---
  doc.rect(tblX, y, col1, headerH);
  doc.text("ที่", tblX + col1 / 2, y + 7.5, { align: "center" });

  // --- Header: "รายการ" cell ---
  doc.rect(tblX + col1, y, col2, headerH);
  doc.text("รายการ", tblX + col1 + col2 / 2, y + 7.5, { align: "center" });

  // --- Header: "จำนวนเงิน" top half ---
  const amtX = tblX + col1 + col2;
  doc.rect(amtX, y, col3 + col4, 6);
  doc.setFontSize(14);
  doc.text("จำนวนเงิน", amtX + (col3 + col4) / 2, y + 4.5, {
    align: "center",
  });

  // --- Header: "บาท" | "สต." bottom half ---
  doc.rect(amtX, y + 6, col3, 6);
  doc.rect(amtX + col3, y + 6, col4, 6);
  doc.text("บาท", amtX + col3 / 2, y + 10.5, { align: "center" });
  doc.text("สต.", amtX + col3 + col4 / 2, y + 10.5, { align: "center" });

  y += headerH;
  doc.setFontSize(15);

  // --- Data rows (different items per receipt type) ---
  for (let j = 0; j < receipt.config.items.length; j++) {
    const item = receipt.config.items[j];

    doc.rect(tblX, y, col1, rowH);
    doc.rect(tblX + col1, y, col2, rowH);
    doc.rect(amtX, y, col3, rowH);
    doc.rect(amtX + col3, y, col4, rowH);

    doc.text(String(j + 1), tblX + col1 / 2, y + 5.5, { align: "center" });
    doc.text(item.name, tblX + col1 + 3, y + 5.5);
    doc.text(item.amount.toLocaleString(), amtX + col3 - 3, y + 5.5, {
      align: "right",
    });
    doc.text("-", amtX + col3 + col4 / 2, y + 5.5, { align: "center" });

    y += rowH;
  }

  // --- Total row ---
  const totalRowH = 8;
  doc.rect(tblX, y, col1 + col2, totalRowH);
  doc.rect(amtX, y, col3, totalRowH);
  doc.rect(amtX + col3, y, col4, totalRowH);

  doc.setFontSize(15);
  doc.text("รวมเงินทั้งสิ้น (บาท)", tblX + (col1 + col2) / 2, y + 5.5, {
    align: "center",
  });
  doc.text(receipt.config.total.toLocaleString(), amtX + col3 - 3, y + 5.5, {
    align: "right",
  });
  doc.text("-", amtX + col3 + col4 / 2, y + 5.5, { align: "center" });

  y += totalRowH + 4;

  // ========== Baht text ==========
  doc.setFontSize(15);
  const bahtText = THBText(receipt.config.total);
  doc.text(`ตัวอักษร (${bahtText})`, offsetX + margin, y);

  // ========== Signature ==========
  y += 15;
  doc.setFontSize(15);
  doc.text(
    "ลงชื่อ..........................................................ผู้รับเงิน",
    cx,
    y,
    { align: "center" }
  );
}

export function generateReceiptPDF(receipts: ReceiptData[], dateStr: string) {
  // A4 Landscape: 297 x 210mm
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  registerFont(doc);

  // Each A4 landscape page fits 1 student with 2 identical copies (left + right)
  const halfWidth = 148.5;

  for (let i = 0; i < receipts.length; i++) {
    if (i > 0) {
      doc.addPage();
    }

    // กำหนดวันที่ตามระดับชั้น: ม.1 = 4 เม.ย. 2569, ม.4 = 5 เม.ย. 2569
    const type = receipts[i].student.receiptType;
    const fixedDate = type === "M1" ? "2026-04-04" : "2026-04-05";
    const dateText = formatThaiDate(fixedDate);

    // Left copy (สำหรับเจ้าหน้าที่การเงิน)
    drawReceipt(doc, receipts[i], 0, dateText, "(สำหรับเจ้าหน้าที่การเงิน)");

    // ========== รอยปะผ่าครึ่งกลางหน้า (perforation line) ==========
    // สัญลักษณ์กรรไกร ✂ ด้านบน
    doc.setFont("THSarabunNew", "normal");
    doc.setFontSize(14);
    doc.setTextColor(120, 120, 120);
    doc.text("\u2702", halfWidth, 5, { align: "center" });

    // เส้นปะผ่า (perforation dots)
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([1, 1.5], 0);
    doc.line(halfWidth, 7, halfWidth, 207);
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(0);
    doc.setTextColor(0, 0, 0);

    // Right copy (same student)
    drawReceipt(doc, receipts[i], halfWidth, dateText);
  }

  doc.save("ใบเสร็จรับเงินชั่วคราว.pdf");
}

// ─── รายงานนักเรียนชำระไม่ครบ ───
type UnderpaidRecord = {
  student: {
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    level: string;
    room: string;
  };
  receiptType: string;
  paidAmount: number;
  expectedAmount: number;
  difference: number;
};

const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_ENGLISH: "ม.4 อังกฤษ",
  M4_CHINESE: "ม.4 จีน",
  M4_JAPANESE: "ม.4 ญี่ปุ่น",
};

export function generateUnderpaidReportPDF(records: UnderpaidRecord[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.addFileToVFS("THSarabunNew.ttf", THSarabunNew);
  doc.addFont("THSarabunNew.ttf", "THSarabunNew", "normal");
  doc.setFont("THSarabunNew");

  // หัวรายงาน
  doc.setFontSize(18);
  doc.text("รายงานนักเรียนที่ชำระเงินไม่ครบจำนวน", 105, 15, { align: "center" });
  doc.setFontSize(12);
  doc.text(`จำนวน ${records.length} คน`, 105, 22, { align: "center" });

  const totalDiff = records.reduce((sum, r) => sum + r.difference, 0);

  // ตาราง
  autoTable(doc, {
    startY: 28,
    head: [["ลำดับ", "เลขประจำตัว", "ชื่อ-สกุล", "ชั้น/ห้อง", "ประเภท", "ยอดชำระ", "ยอดเต็ม", "ส่วนต่าง"]],
    body: records.map((r, i) => [
      i + 1,
      r.student.studentCode,
      `${r.student.prefix}${r.student.firstName} ${r.student.lastName}`,
      `${r.student.level}/${r.student.room}`,
      receiptTypeLabels[r.receiptType] || r.receiptType,
      r.paidAmount.toLocaleString(),
      r.expectedAmount.toLocaleString(),
      r.difference.toLocaleString(),
    ]),
    foot: [["", "", "", "", "", "", "รวมส่วนต่าง", totalDiff.toLocaleString()]],
    styles: {
      font: "THSarabunNew",
      fontSize: 13,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      fontSize: 13,
    },
    footStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 14,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
  });

  doc.save("รายงานชำระไม่ครบ.pdf");
}
