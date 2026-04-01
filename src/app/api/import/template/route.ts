import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

const m4SheetNames = ["ทั่วไป", "อังกฤษ", "จีน", "ญี่ปุ่น"];

function addStudentSheet(workbook: ExcelJS.Workbook, sheetName: string, sampleData: { studentCode: string; prefix: string; firstName: string; lastName: string; level: string; room: string }[]) {
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = [
    { header: "เลขประจำตัว", key: "studentCode", width: 18 },
    { header: "คำนำหน้า", key: "prefix", width: 14 },
    { header: "ชื่อ", key: "firstName", width: 20 },
    { header: "นามสกุล", key: "lastName", width: 20 },
    { header: "ชั้น", key: "level", width: 10 },
    { header: "ห้อง", key: "room", width: 10 },
  ];

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
}

function addInstructionSheet(workbook: ExcelJS.Workbook, instructions: string[]) {
  const instrSheet = workbook.addWorksheet("คำแนะนำ");
  instrSheet.columns = [
    { header: "", key: "col1", width: 60 },
  ];

  instructions.forEach((text, i) => {
    const row = instrSheet.addRow({ col1: text });
    if (i === 0) {
      row.font = { bold: true, size: 16, name: "TH SarabunPSK" };
    } else {
      row.font = { size: 14, name: "TH SarabunPSK" };
    }
  });
}

export async function GET(request: NextRequest) {
  const grade = request.nextUrl.searchParams.get("grade");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ระบบใบเสร็จรับเงิน";
  workbook.created = new Date();

  if (grade === "m4") {
    // Template ม.4: 4 Sheet แยกตามประเภท
    const m4SampleData: Record<string, { studentCode: string; prefix: string; firstName: string; lastName: string; level: string; room: string }[]> = {
      "ทั่วไป": [
        { studentCode: "30001", prefix: "นาย", firstName: "สมชาย", lastName: "ใจดี", level: "4", room: "1" },
        { studentCode: "30002", prefix: "นางสาว", firstName: "สมหญิง", lastName: "รักเรียน", level: "4", room: "1" },
      ],
      "อังกฤษ": [
        { studentCode: "30010", prefix: "นาย", firstName: "วิชัย", lastName: "เก่งกล้า", level: "4", room: "5" },
        { studentCode: "30011", prefix: "นางสาว", firstName: "พิมพ์", lastName: "สวยงาม", level: "4", room: "5" },
      ],
      "จีน": [
        { studentCode: "30020", prefix: "นาย", firstName: "ธนา", lastName: "มั่งมี", level: "4", room: "6" },
        { studentCode: "30021", prefix: "นางสาว", firstName: "จันทร์", lastName: "แจ่มใส", level: "4", room: "6" },
      ],
      "ญี่ปุ่น": [
        { studentCode: "30030", prefix: "นาย", firstName: "ภูมิ", lastName: "พัฒนา", level: "4", room: "7" },
        { studentCode: "30031", prefix: "นางสาว", firstName: "ดาว", lastName: "สดใส", level: "4", room: "7" },
      ],
    };

    for (const sheetName of m4SheetNames) {
      addStudentSheet(workbook, sheetName, m4SampleData[sheetName]);
    }

    addInstructionSheet(workbook, [
      "คำแนะนำการใช้งาน Template นำเข้าข้อมูลนักเรียน ม.4",
      "",
      "1. กรอกข้อมูลนักเรียนในแต่ละแผ่นตามประเภท:",
      '   - แผ่น "ทั่วไป" = นักเรียนสายทั่วไป',
      '   - แผ่น "อังกฤษ" = นักเรียนสายภาษาอังกฤษ',
      '   - แผ่น "จีน" = นักเรียนสายภาษาจีน',
      '   - แผ่น "ญี่ปุ่น" = นักเรียนสายภาษาญี่ปุ่น',
      "",
      "2. ลบข้อมูลตัวอย่าง (แถวสีเทา) ออกก่อนนำเข้า",
      "3. คอลัมน์ที่จำเป็น: เลขประจำตัว, ชื่อ, นามสกุล",
      "4. คำนำหน้า เช่น: นาย, นางสาว",
      "5. ชั้น: 4",
      "6. ห้อง เช่น: 1, 2, 3",
      "",
      "หมายเหตุ:",
      "- ห้ามเปลี่ยนชื่อแผ่นงาน (Sheet) เพราะระบบใช้ชื่อแผ่นในการกำหนดประเภท",
      "- ห้ามเปลี่ยนลำดับคอลัมน์",
      "- ระบบจะกำหนดประเภทใบเสร็จให้อัตโนมัติตามแผ่นที่กรอกข้อมูล",
    ]);

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="template_import_m4.xlsx"',
      },
    });
  }

  // Default: Template ม.1 (เดิม)
  addStudentSheet(workbook, "ข้อมูลนักเรียน", [
    { studentCode: "12345", prefix: "เด็กชาย", firstName: "สมชาย", lastName: "ใจดี", level: "1", room: "1" },
    { studentCode: "12346", prefix: "เด็กหญิง", firstName: "สมหญิง", lastName: "รักเรียน", level: "1", room: "2" },
    { studentCode: "12347", prefix: "นาย", firstName: "วิชัย", lastName: "เก่งกล้า", level: "4", room: "1" },
  ]);

  addInstructionSheet(workbook, [
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
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template_import_students.xlsx"',
    },
  });
}
