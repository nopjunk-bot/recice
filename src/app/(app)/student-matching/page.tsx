"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  ArrowLeftRight,
  FileSpreadsheet,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import type ExcelJS from "exceljs";

type MatchedStudent = {
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
};

type UnmatchedDb = {
  id: string;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
};

type UnmatchedExcel = {
  studentCode: string;
  nationalId: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
};

type Report = {
  summary: {
    totalDbStudents: number;
    totalExcelStudents: number;
    matched: number;
    unmatchedDb: number;
    unmatchedExcel: number;
    roomDifferences: number;
    levelDifferences: number;
  };
  matchedStudents: MatchedStudent[];
  unmatchedDb: UnmatchedDb[];
  unmatchedExcel: UnmatchedExcel[];
};

export default function StudentMatchingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  // Filters for matched tab
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [onlyDiff, setOnlyDiff] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters for unmatched tabs
  const [searchUnmatchedDb, setSearchUnmatchedDb] = useState("");
  const [searchUnmatchedExcel, setSearchUnmatchedExcel] = useState("");

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  }

  async function handleUpload() {
    if (!file) {
      toast.error("กรุณาเลือกไฟล์ Excel");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/student-matching", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      setReport(data);
      setApplied(false);
      setActiveTab("summary");
      toast.success(
        `จับคู่สำเร็จ ${data.summary.matched} คน จากทั้งหมด ${data.summary.totalExcelStudents} คน`
      );
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setUploading(false);
    }
  }

  // Filter matched students
  const filteredMatched = report?.matchedStudents.filter((m) => {
    if (onlyDiff && !m.roomChanged && !m.levelChanged) return false;
    if (filterLevel !== "all" && m.excelLevel !== filterLevel) return false;
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      return (
        m.dbFirstName.toLowerCase().includes(s) ||
        m.dbLastName.toLowerCase().includes(s) ||
        m.excelFirstName.toLowerCase().includes(s) ||
        m.excelLastName.toLowerCase().includes(s) ||
        m.dbStudentCode.includes(s) ||
        m.excelStudentCode.includes(s)
      );
    }
    return true;
  }) || [];

  // Filter unmatched DB
  const filteredUnmatchedDb = report?.unmatchedDb.filter((s) => {
    if (!searchUnmatchedDb) return true;
    const q = searchUnmatchedDb.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.studentCode.includes(q)
    );
  }) || [];

  // Filter unmatched Excel
  const filteredUnmatchedExcel = report?.unmatchedExcel.filter((s) => {
    if (!searchUnmatchedExcel) return true;
    const q = searchUnmatchedExcel.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.studentCode.includes(q)
    );
  }) || [];

  // Get unique levels from matched data
  const levels = report
    ? [...new Set(report.matchedStudents.map((m) => m.excelLevel))].sort(
        (a, b) => Number(a) - Number(b)
      )
    : [];

  async function handleDownloadTemplate() {
    try {
      const ExcelJSModule = await import("exceljs");
      const wb = new ExcelJSModule.default.Workbook();

      const sampleData: Record<string, { room: string; students: { code: string; nid: string; prefix: string; firstName: string; lastName: string }[] }[]> = {
        "1": [
          {
            room: "1",
            students: [
              { code: "10001", nid: "1234567890123", prefix: "เด็กชาย", firstName: "สมชาย", lastName: "ใจดี" },
              { code: "10002", nid: "1234567890124", prefix: "เด็กหญิง", firstName: "สมหญิง", lastName: "รักเรียน" },
            ],
          },
          {
            room: "2",
            students: [
              { code: "10003", nid: "1234567890125", prefix: "เด็กชาย", firstName: "ธนพล", lastName: "มั่นคง" },
            ],
          },
        ],
        "2": [
          {
            room: "1",
            students: [
              { code: "20001", nid: "1234567890126", prefix: "เด็กชาย", firstName: "วีรชัย", lastName: "พิทักษ์" },
            ],
          },
        ],
        "3": [
          {
            room: "1",
            students: [
              { code: "30001", nid: "1234567890127", prefix: "เด็กหญิง", firstName: "พิมพ์ใจ", lastName: "งามเลิศ" },
            ],
          },
        ],
        "4": [
          {
            room: "1",
            students: [
              { code: "40001", nid: "1234567890128", prefix: "นาย", firstName: "อนุชา", lastName: "ชาญฉลาด" },
            ],
          },
        ],
        "5": [
          {
            room: "1",
            students: [
              { code: "50001", nid: "1234567890129", prefix: "นางสาว", firstName: "ปรีดา", lastName: "สุขใจ" },
            ],
          },
        ],
        "6": [
          {
            room: "1",
            students: [
              { code: "60001", nid: "1234567890130", prefix: "นาย", firstName: "ภาคิน", lastName: "เจริญรุ่ง" },
            ],
          },
        ],
      };

      for (const level of ["1", "2", "3", "4", "5", "6"]) {
        const ws = wb.addWorksheet(`ม.${level}`);
        ws.columns = [
          { width: 8 },
          { width: 15 },
          { width: 18 },
          { width: 35 },
          { width: 20 },
          { width: 20 },
        ];

        const headerRow = ws.addRow([
          "เลขที่",
          "รหัสประจำตัว",
          "เลขบัตรประชาชน",
          "คำนำหน้า",
          "ชื่อ",
          "นามสกุล",
        ]);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: "center", vertical: "middle" };
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE5E7EB" },
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });

        const rooms = sampleData[level] || [];
        for (const r of rooms) {
          // Room header row (col 4 must contain "มัธยมศึกษาปีที่ X/Y")
          const roomHeader = ws.addRow([
            "",
            "",
            "",
            `รายชื่อนักเรียนชั้นมัธยมศึกษาปีที่ ${level}/${r.room}`,
            "",
            "",
          ]);
          roomHeader.font = { bold: true };
          ws.mergeCells(`A${roomHeader.number}:F${roomHeader.number}`);
          const mergedCell = ws.getCell(`D${roomHeader.number}`);
          mergedCell.alignment = { horizontal: "center" };
          mergedCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" },
          };

          // Data rows
          r.students.forEach((s, idx) => {
            const dataRow = ws.addRow([
              idx + 1,
              s.code,
              s.nid,
              s.prefix,
              s.firstName,
              s.lastName,
            ]);
            dataRow.getCell(1).alignment = { horizontal: "center" };
            dataRow.getCell(2).numFmt = "@";
            dataRow.getCell(3).numFmt = "@";
          });
        }

        // Add instruction sheet content via top note (only on ม.1)
        if (level === "1") {
          ws.insertRow(1, [
            "หมายเหตุ: แต่ละ Sheet คือชั้น (ม.1 - ม.6) | ใส่หัวห้องในรูปแบบ \"รายชื่อนักเรียนชั้นมัธยมศึกษาปีที่ X/Y\" ที่คอลัมน์ D ก่อนแถวข้อมูล",
          ]);
          ws.mergeCells("A1:F1");
          const note = ws.getCell("A1");
          note.font = { italic: true, color: { argb: "FF92400E" } };
          note.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFBEB" },
          };
          note.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
          ws.getRow(1).height = 30;
        }
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Template-รายชื่อนักเรียน.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ดาวน์โหลด Template สำเร็จ");
    } catch {
      toast.error("เกิดข้อผิดพลาดในการสร้าง Template");
    }
  }

  async function handleApply() {
    if (!report) return;
    const changedStudents = report.matchedStudents.filter(
      (m) => m.roomChanged || m.levelChanged
    );
    if (changedStudents.length === 0) {
      toast.info("ไม่มีนักเรียนที่ต้องอัปเดตห้อง/ชั้น");
      return;
    }

    const confirmed = window.confirm(
      `คุณต้องการอัปเดตชั้น/ห้องของนักเรียน ${changedStudents.length} คน ตามผลจับคู่จากไฟล์วิชาการใช่หรือไม่?\n\nการดำเนินการนี้จะเขียนทับข้อมูลเดิมในระบบ และไม่สามารถย้อนกลับได้`
    );
    if (!confirmed) return;

    setApplying(true);
    try {
      const updates = changedStudents.map((m) => ({
        id: m.dbId,
        level: m.excelLevel,
        room: m.excelRoom,
      }));

      const res = await fetch("/api/student-matching/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "เกิดข้อผิดพลาดในการบันทึก");
        return;
      }

      setApplied(true);
      toast.success(`อัปเดตชั้น/ห้องของนักเรียน ${data.updated} คนสำเร็จ`);
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setApplying(false);
    }
  }

  async function handleExport() {
    if (!report) return;

    const ExcelJSModule = await import("exceljs");
    const wb = new ExcelJSModule.default.Workbook();

    // Sheet 1: Summary
    const wsSummary = wb.addWorksheet("สรุป");
    wsSummary.columns = [
      { header: "รายการ", key: "label", width: 30 },
      { header: "จำนวน", key: "value", width: 15 },
    ];
    wsSummary.addRows([
      { label: "นักเรียนในระบบทั้งหมด", value: report.summary.totalDbStudents },
      { label: "นักเรียนในไฟล์วิชาการทั้งหมด", value: report.summary.totalExcelStudents },
      { label: "จับคู่สำเร็จ", value: report.summary.matched },
      { label: "ห้องไม่ตรงกัน", value: report.summary.roomDifferences },
      { label: "ชั้นไม่ตรงกัน", value: report.summary.levelDifferences },
      { label: "ไม่พบในไฟล์วิชาการ", value: report.summary.unmatchedDb },
      { label: "ไม่พบในระบบ", value: report.summary.unmatchedExcel },
    ]);
    wsSummary.getRow(1).font = { bold: true };

    // Sheet 2: Matched
    const wsMatched = wb.addWorksheet("จับคู่สำเร็จ");
    wsMatched.columns = [
      { header: "ชื่อ-นามสกุล", key: "name", width: 25 },
      { header: "รหัส (ระบบ)", key: "dbCode", width: 15 },
      { header: "รหัส (วิชาการ)", key: "exCode", width: 15 },
      { header: "เลขบัตร ปชช.", key: "nationalId", width: 18 },
      { header: "ชั้น/ห้อง (ระบบ)", key: "dbRoom", width: 15 },
      { header: "ชั้น/ห้อง (วิชาการ)", key: "exRoom", width: 15 },
      { header: "สถานะ", key: "status", width: 15 },
    ];
    for (const m of report.matchedStudents) {
      const status = m.roomChanged
        ? "ห้องไม่ตรง"
        : m.levelChanged
        ? "ชั้นไม่ตรง"
        : "ตรงกัน";
      wsMatched.addRow({
        name: `${m.dbPrefix}${m.dbFirstName} ${m.dbLastName}`,
        dbCode: m.dbStudentCode,
        exCode: m.excelStudentCode,
        nationalId: m.excelNationalId,
        dbRoom: `ม.${m.dbLevel}/${m.dbRoom}`,
        exRoom: `ม.${m.excelLevel}/${m.excelRoom}`,
        status,
      });
    }
    wsMatched.getRow(1).font = { bold: true };

    // Sheet 3: Unmatched DB
    const wsUnDb = wb.addWorksheet("ไม่พบในไฟล์วิชาการ");
    wsUnDb.columns = [
      { header: "รหัสประจำตัว", key: "code", width: 15 },
      { header: "ชื่อ-นามสกุล", key: "name", width: 25 },
      { header: "ชั้น/ห้อง", key: "room", width: 12 },
    ];
    for (const s of report.unmatchedDb) {
      wsUnDb.addRow({
        code: s.studentCode,
        name: `${s.prefix}${s.firstName} ${s.lastName}`,
        room: `ม.${s.level}/${s.room}`,
      });
    }
    wsUnDb.getRow(1).font = { bold: true };

    // Sheet 4: Unmatched Excel
    const wsUnEx = wb.addWorksheet("ไม่พบในระบบ");
    wsUnEx.columns = [
      { header: "รหัสประจำตัว", key: "code", width: 15 },
      { header: "เลขบัตร ปชช.", key: "nationalId", width: 18 },
      { header: "ชื่อ-นามสกุล", key: "name", width: 25 },
      { header: "ชั้น/ห้อง", key: "room", width: 12 },
    ];
    for (const s of report.unmatchedExcel) {
      wsUnEx.addRow({
        code: s.studentCode,
        nationalId: s.nationalId,
        name: `${s.prefix}${s.firstName} ${s.lastName}`,
        room: `ม.${s.level}/${s.room}`,
      });
    }
    wsUnEx.getRow(1).font = { bold: true };

    // Download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "รายงานจับคู่นักเรียน.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ดาวน์โหลดรายงานสำเร็จ");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">จับคู่รายชื่อนักเรียน</h1>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="w-5 h-5" />
              อัปโหลดไฟล์รายชื่อจากวิชาการ
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              ดาวน์โหลด Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            เลือกไฟล์ Excel (.xlsx) ที่ได้รับจากงานวิชาการ
            ระบบจะจับคู่ชื่อ-นามสกุลของนักเรียนในฐานข้อมูลกับไฟล์ที่อัปโหลด
            เพื่อเปรียบเทียบข้อมูลชั้น/ห้องเรียน
            หากยังไม่มีไฟล์ สามารถดาวน์โหลด Template เพื่อกรอกข้อมูลตามรูปแบบที่ระบบรองรับได้
          </p>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="max-w-sm"
            />
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? "กำลังจับคู่..." : "เริ่มจับคู่"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Section */}
      {report && (
        <>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={handleApply}
              disabled={
                applying ||
                applied ||
                report.summary.roomDifferences + report.summary.levelDifferences === 0
              }
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {applied
                ? "บันทึกแล้ว"
                : applying
                ? "กำลังบันทึก..."
                : `บันทึกผลจับคู่ลงระบบ (${report.summary.roomDifferences + report.summary.levelDifferences} คน)`}
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              ดาวน์โหลดรายงาน Excel
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="summary" className="gap-2">
                <Users className="w-4 h-4" />
                สรุป
              </TabsTrigger>
              <TabsTrigger value="matched" className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                จับคู่สำเร็จ ({report.summary.matched})
              </TabsTrigger>
              <TabsTrigger value="unmatched-db" className="gap-2">
                <AlertTriangle className="w-4 h-4" />
                ไม่พบในไฟล์ ({report.summary.unmatchedDb})
              </TabsTrigger>
              <TabsTrigger value="unmatched-excel" className="gap-2">
                <XCircle className="w-4 h-4" />
                ไม่พบในระบบ ({report.summary.unmatchedExcel})
              </TabsTrigger>
            </TabsList>

            {/* Tab: Summary */}
            <TabsContent value="summary">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {report.summary.totalDbStudents}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      นักเรียนในระบบ
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {report.summary.totalExcelStudents}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      นักเรียนในไฟล์วิชาการ
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {report.summary.matched}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      จับคู่สำเร็จ
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-orange-600">
                      {report.summary.roomDifferences}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ห้องไม่ตรงกัน
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-purple-600">
                      {report.summary.levelDifferences}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ชั้นไม่ตรงกัน
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-amber-600">
                      {report.summary.unmatchedDb}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ไม่พบในไฟล์วิชาการ
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold text-red-600">
                      {report.summary.unmatchedExcel}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ไม่พบในระบบ
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab: Matched */}
            <TabsContent value="matched">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    รายชื่อจับคู่สำเร็จ ({filteredMatched.length} คน)
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="ค้นหาชื่อหรือรหัส..."
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={filterLevel} onValueChange={setFilterLevel}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="ทุกชั้น" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทุกชั้น</SelectItem>
                        {levels.map((l) => (
                          <SelectItem key={l} value={l}>
                            ม.{l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="onlyDiff"
                        checked={onlyDiff}
                        onCheckedChange={(v) => setOnlyDiff(v === true)}
                      />
                      <label htmlFor="onlyDiff" className="text-sm cursor-pointer">
                        แสดงเฉพาะห้อง/ชั้นไม่ตรง
                      </label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ชื่อ-นามสกุล</TableHead>
                          <TableHead>รหัส (ระบบ)</TableHead>
                          <TableHead>รหัส (วิชาการ)</TableHead>
                          <TableHead>ชั้น/ห้อง (ระบบ)</TableHead>
                          <TableHead>ชั้น/ห้อง (วิชาการ)</TableHead>
                          <TableHead>สถานะ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMatched.map((m) => (
                          <TableRow
                            key={m.dbId}
                            className={
                              m.roomChanged || m.levelChanged
                                ? "bg-orange-50"
                                : ""
                            }
                          >
                            <TableCell>
                              {m.dbPrefix}{m.dbFirstName} {m.dbLastName}
                            </TableCell>
                            <TableCell className="font-mono">
                              {m.dbStudentCode}
                            </TableCell>
                            <TableCell className="font-mono">
                              {m.excelStudentCode}
                            </TableCell>
                            <TableCell>
                              ม.{m.dbLevel}/{m.dbRoom}
                            </TableCell>
                            <TableCell>
                              ม.{m.excelLevel}/{m.excelRoom}
                            </TableCell>
                            <TableCell>
                              {m.roomChanged || m.levelChanged ? (
                                <Badge className="bg-orange-100 text-orange-700">
                                  <ArrowLeftRight className="w-3 h-3 mr-1" />
                                  {m.levelChanged ? "ชั้นไม่ตรง" : "ห้องไม่ตรง"}
                                </Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-700">
                                  ตรงกัน
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredMatched.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-8 text-muted-foreground"
                            >
                              ไม่พบข้อมูล
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Unmatched DB */}
            <TabsContent value="unmatched-db">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    นักเรียนในระบบที่ไม่พบในไฟล์วิชาการ ({filteredUnmatchedDb.length} คน)
                  </CardTitle>
                  <div className="relative max-w-sm mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหาชื่อหรือรหัส..."
                      value={searchUnmatchedDb}
                      onChange={(e) => setSearchUnmatchedDb(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>รหัสประจำตัว</TableHead>
                        <TableHead>ชื่อ-นามสกุล</TableHead>
                        <TableHead>ชั้น/ห้อง</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUnmatchedDb.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono">
                            {s.studentCode}
                          </TableCell>
                          <TableCell>
                            {s.prefix}{s.firstName} {s.lastName}
                          </TableCell>
                          <TableCell>
                            ม.{s.level}/{s.room}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUnmatchedDb.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center py-8 text-muted-foreground"
                          >
                            ไม่พบข้อมูล
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Unmatched Excel */}
            <TabsContent value="unmatched-excel">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    นักเรียนในไฟล์วิชาการที่ไม่พบในระบบ ({filteredUnmatchedExcel.length} คน)
                  </CardTitle>
                  <div className="relative max-w-sm mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหาชื่อหรือรหัส..."
                      value={searchUnmatchedExcel}
                      onChange={(e) => setSearchUnmatchedExcel(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>รหัสประจำตัว</TableHead>
                        <TableHead>เลขบัตร ปชช.</TableHead>
                        <TableHead>ชื่อ-นามสกุล</TableHead>
                        <TableHead>ชั้น/ห้อง</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUnmatchedExcel.map((s, i) => (
                        <TableRow key={`${s.studentCode}-${i}`}>
                          <TableCell className="font-mono">
                            {s.studentCode}
                          </TableCell>
                          <TableCell className="font-mono">
                            {s.nationalId}
                          </TableCell>
                          <TableCell>
                            {s.prefix}{s.firstName} {s.lastName}
                          </TableCell>
                          <TableCell>
                            ม.{s.level}/{s.room}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUnmatchedExcel.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center py-8 text-muted-foreground"
                          >
                            ไม่พบข้อมูล
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
