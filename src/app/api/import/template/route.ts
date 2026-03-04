import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ระบบใบเสร็จรับเงิน";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("ข้อมูลนักเรียน");

  // Define columns with headers
  worksheet.columns = [
    { header: "เลขประจำตัว", key: "studentCode", width: 18 },
    { header: "คำนำหน้า", key: "prefix", width: 14 },
    { header: "ชื่อ", key: "firstName", width: 20 },
    { header: "นามสกุล", key: "lastName", width: 20 },
    { header: "ชั้น", key: "level", width: 10 },
    { header: "ห้อง", key: "room", width: 10 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 14, name: "TH SarabunPSK" };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" }, name: "TH SarabunPSK" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Add sample data rows
  const sampleData = [
    { studentCode: "12345", prefix: "เด็กชาย", firstName: "สมชาย", lastName: "ใจดี", level: "1", room: "1" },
    { studentCode: "12346", prefix: "เด็กหญิง", firstName: "สมหญิง", lastName: "รักเรียน", level: "1", room: "2" },
    { studentCode: "12347", prefix: "นาย", firstName: "วิชัย", lastName: "เก่งกล้า", level: "4", room: "1" },
  ];

  sampleData.forEach((data) => {
    const row = worksheet.addRow(data);
    row.font = { size: 14, name: "TH SarabunPSK", color: { argb: "FF808080" } };
    row.alignment = { horizontal: "center", vertical: "middle" };
    row.height = 24;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };
    });
  });

  // Add instruction sheet
  const instrSheet = workbook.addWorksheet("คำแนะนำ");
  instrSheet.columns = [
    { header: "", key: "col1", width: 60 },
  ];

  const instructions = [
    "คำแนะนำการใช้งาน Template นำเข้าข้อมูลนักเรียน",
    "",
    "1. กรอกข้อมูลในแผ่น \"ข้อมูลนักเรียน\"",
    "2. ลบข้อมูลตัวอย่าง (แถวที่ 2-4 สีเทา) ออกก่อนนำเข้า",
    "3. คอลัมน์ที่จำเป็น: เลขประจำตัว, ชื่อ, นามสกุล",
    "4. คำนำหน้า เช่น: เด็กชาย, เด็กหญิง, นาย, นางสาว",
    "5. ชั้น เช่น: 1, 4",
    "6. ห้อง เช่น: 1, 2, 3",
    "",
    "หมายเหตุ: ห้ามเปลี่ยนลำดับคอลัมน์ในแผ่น \"ข้อมูลนักเรียน\"",
  ];

  instructions.forEach((text, i) => {
    const row = instrSheet.addRow({ col1: text });
    if (i === 0) {
      row.font = { bold: true, size: 16, name: "TH SarabunPSK" };
    } else {
      row.font = { size: 14, name: "TH SarabunPSK" };
    }
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template_import_students.xlsx"',
    },
  });
}
