import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import ExcelJS from "exceljs";

type ExcelStudent = {
  studentCode: string;
  nationalId: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
};

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseExcel(workbook: ExcelJS.Workbook): ExcelStudent[] {
  const students: ExcelStudent[] = [];

  for (const worksheet of workbook.worksheets) {
    // Extract level from sheet name: "ม.1" → "1", "ม.4" → "4"
    const sheetMatch = worksheet.name.match(/ม\.(\d+)/);
    if (!sheetMatch) continue;
    const level = sheetMatch[1];

    let currentRoom = "1"; // default first room

    worksheet.eachRow((row, rowNumber) => {
      // Check if this row is a room header
      // Pattern: "รายชื่อนักเรียนชั้นมัธยมศึกษาปีที่ X/Y"
      const col4 = String(row.getCell(4).value || "").trim();
      const roomMatch = col4.match(/มัธยมศึกษาปีที่\s*\d+\/(\d+)/);
      if (roomMatch) {
        currentRoom = roomMatch[1];
        return; // skip this row
      }

      // Check if data row: col 1 must be a number (เลขที่)
      const col1 = String(row.getCell(1).value || "").trim();
      if (!col1 || isNaN(Number(col1))) return;

      const studentCode = String(row.getCell(2).value || "").trim();
      const nationalId = String(row.getCell(3).value || "").trim();
      const prefix = String(row.getCell(4).value || "").trim();
      const firstName = String(row.getCell(5).value || "").trim();
      const lastName = String(row.getCell(6).value || "").trim();

      if (firstName && lastName) {
        students.push({
          studentCode,
          nationalId,
          prefix,
          firstName,
          lastName,
          level,
          room: currentRoom,
        });
      }
    });
  }

  return students;
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "กรุณาเลือกไฟล์ Excel" },
        { status: 400 }
      );
    }

    // Parse Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer as ExcelJS.Buffer);

    const excelStudents = parseExcel(workbook);

    if (excelStudents.length === 0) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลนักเรียนในไฟล์ Excel" },
        { status: 400 }
      );
    }

    // Fetch all DB students
    const dbStudents = await prisma.student.findMany({
      select: {
        id: true,
        studentCode: true,
        prefix: true,
        firstName: true,
        lastName: true,
        level: true,
        room: true,
      },
    });

    // Build lookup map: normalized "firstName|lastName" → DB student array
    const dbMap = new Map<string, typeof dbStudents>();
    for (const s of dbStudents) {
      const key = `${normalize(s.firstName)}|${normalize(s.lastName)}`;
      const arr = dbMap.get(key) || [];
      arr.push(s);
      dbMap.set(key, arr);
    }

    // Match
    const matched: {
      dbId: string;
      dbStudentCode: string;
      dbPrefix: string;
      dbFirstName: string;
      dbLastName: string;
      dbLevel: string;
      dbRoom: string;
      excelStudentCode: string;
      excelNationalId: string;
      excelPrefix: string;
      excelFirstName: string;
      excelLastName: string;
      excelLevel: string;
      excelRoom: string;
      roomChanged: boolean;
      levelChanged: boolean;
    }[] = [];

    const unmatchedExcel: ExcelStudent[] = [];

    for (const exStudent of excelStudents) {
      const key = `${normalize(exStudent.firstName)}|${normalize(exStudent.lastName)}`;
      const candidates = dbMap.get(key);

      if (!candidates || candidates.length === 0) {
        unmatchedExcel.push(exStudent);
        continue;
      }

      // Pick best match
      let best = candidates[0];
      if (candidates.length > 1) {
        // Try matching prefix + level
        const prefixLevelMatch = candidates.find(
          (c) =>
            normalize(c.prefix) === normalize(exStudent.prefix) &&
            c.level === exStudent.level
        );
        if (prefixLevelMatch) {
          best = prefixLevelMatch;
        } else {
          // Try matching level only
          const levelMatch = candidates.find(
            (c) => c.level === exStudent.level
          );
          if (levelMatch) best = levelMatch;
        }
      }

      // Remove matched from candidates
      const idx = candidates.indexOf(best);
      candidates.splice(idx, 1);
      if (candidates.length === 0) dbMap.delete(key);

      matched.push({
        dbId: best.id,
        dbStudentCode: best.studentCode,
        dbPrefix: best.prefix,
        dbFirstName: best.firstName,
        dbLastName: best.lastName,
        dbLevel: best.level,
        dbRoom: best.room,
        excelStudentCode: exStudent.studentCode,
        excelNationalId: exStudent.nationalId,
        excelPrefix: exStudent.prefix,
        excelFirstName: exStudent.firstName,
        excelLastName: exStudent.lastName,
        excelLevel: exStudent.level,
        excelRoom: exStudent.room,
        roomChanged: best.room !== exStudent.room,
        levelChanged: best.level !== exStudent.level,
      });
    }

    // Remaining in dbMap = unmatched DB students
    const unmatchedDb: {
      id: string;
      studentCode: string;
      prefix: string;
      firstName: string;
      lastName: string;
      level: string;
      room: string;
    }[] = [];
    for (const arr of dbMap.values()) {
      for (const s of arr) {
        unmatchedDb.push(s);
      }
    }

    const roomDifferences = matched.filter((m) => m.roomChanged).length;
    const levelDifferences = matched.filter((m) => m.levelChanged).length;

    return NextResponse.json({
      summary: {
        totalDbStudents: dbStudents.length,
        totalExcelStudents: excelStudents.length,
        matched: matched.length,
        unmatchedDb: unmatchedDb.length,
        unmatchedExcel: unmatchedExcel.length,
        roomDifferences,
        levelDifferences,
      },
      matchedStudents: matched,
      unmatchedDb,
      unmatchedExcel,
    });
  } catch (error) {
    console.error("Student matching error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการจับคู่ข้อมูล" },
      { status: 500 }
    );
  }
}
