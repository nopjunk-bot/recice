"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Student = {
  id: string;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
  receiptType: string;
  receipts: { id: string }[];
};

const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_LANG: "ม.4 อังกฤษ จีน ญี่ปุ่น",
};

export default function ReceiptsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [search, filterType]);

  async function loadStudents() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterType && filterType !== "all") params.set("receiptType", filterType);
    const res = await fetch(`/api/students?${params}`);
    const data = await res.json();
    setStudents(data);
  }

  function toggleAll() {
    if (selected.size === students.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(students.map((s) => s.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleGenerate() {
    if (selected.size === 0) {
      toast.error("กรุณาเลือกนักเรียนอย่างน้อย 1 คน");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/receipts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: Array.from(selected) }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }

      // Generate PDF on client side
      await generatePDF(data.receipts);
      toast.success(`สร้างใบเสร็จ ${data.receipts.length} ใบสำเร็จ`);
      loadStudents();
    } catch {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setGenerating(false);
    }
  }

  async function generatePDF(
    receipts: {
      student: Student;
      receiptNumber: string;
      config: {
        title: string;
        items: { name: string; amount: number }[];
        total: number;
      };
      barcodeData: string;
    }[]
  ) {
    const { default: jsPDF } = await import("jspdf");
    const { default: JsBarcode } = await import("jsbarcode");
    const { default: THBText } = await import("thai-baht-text");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // A4 = 210 x 297mm, each receipt = A5 = 105 x ~148mm (2 per page side by side)
    const receiptWidth = 105;
    const pageHeight = 297;

    for (let i = 0; i < receipts.length; i++) {
      const receipt = receipts[i];
      // Two copies side by side (left and right)
      for (let side = 0; side < 2; side++) {
        const offsetX = side * receiptWidth;

        if (i > 0 && side === 0) {
          doc.addPage();
        }

        // Barcode at top-left corner
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, receipt.barcodeData, {
          format: "CODE128",
          width: 1.5,
          height: 30,
          displayValue: true,
          fontSize: 8,
          margin: 2,
        });
        const barcodeImg = canvas.toDataURL("image/png");
        doc.addImage(barcodeImg, "PNG", offsetX + 3, 5, 35, 15);

        // Receipt number
        doc.setFontSize(9);
        doc.text(
          `เลขที่ ${receipt.receiptNumber}`,
          offsetX + receiptWidth - 10,
          10,
          { align: "right" }
        );
        doc.text("(สำหรับนักเรียน)", offsetX + receiptWidth - 10, 15, {
          align: "right",
        });

        // Title
        let y = 30;
        doc.setFontSize(13);
        doc.text(receipt.config.title, offsetX + receiptWidth / 2, y, {
          align: "center",
        });

        y += 6;
        doc.setFontSize(9);
        doc.text(
          "498 ตำบลเนินพระ อำเภอเมืองระยอง จังหวัดระยอง",
          offsetX + receiptWidth / 2,
          y,
          { align: "center" }
        );

        y += 5;
        doc.text(
          "วันที่       เดือน เมษายน พ.ศ. 2569",
          offsetX + receiptWidth / 2,
          y,
          { align: "center" }
        );

        y += 6;
        doc.setFontSize(9);
        const fullName = `${receipt.student.prefix}${receipt.student.firstName} ${receipt.student.lastName}`;
        doc.text(`ได้รับเงินจาก ${fullName}`, offsetX + 5, y);
        doc.text(
          `ชั้น ${receipt.student.level}/${receipt.student.room}`,
          offsetX + receiptWidth - 5,
          y,
          { align: "right" }
        );

        // Table header
        y += 6;
        const tableX = offsetX + 5;
        const tableW = receiptWidth - 10;
        const colWidths = [8, tableW - 28, 14, 6];

        doc.setFontSize(8);
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);

        // Header row
        doc.rect(tableX, y, colWidths[0], 8);
        doc.rect(tableX + colWidths[0], y, colWidths[1], 8);
        doc.rect(tableX + colWidths[0] + colWidths[1], y, colWidths[2], 4);
        doc.rect(tableX + colWidths[0] + colWidths[1], y + 4, colWidths[2] / 2, 4);
        doc.rect(
          tableX + colWidths[0] + colWidths[1] + colWidths[2] / 2,
          y + 4,
          colWidths[2] / 2,
          4
        );

        doc.text("ที่", tableX + colWidths[0] / 2, y + 5, { align: "center" });
        doc.text("รายการ", tableX + colWidths[0] + colWidths[1] / 2, y + 5, {
          align: "center",
        });
        doc.text(
          "จำนวนเงิน",
          tableX + colWidths[0] + colWidths[1] + colWidths[2] / 2,
          y + 3,
          { align: "center" }
        );
        doc.setFontSize(7);
        doc.text(
          "บาท",
          tableX + colWidths[0] + colWidths[1] + colWidths[2] / 4,
          y + 7,
          { align: "center" }
        );
        doc.text(
          "สต.",
          tableX + colWidths[0] + colWidths[1] + (colWidths[2] * 3) / 4,
          y + 7,
          { align: "center" }
        );

        y += 8;
        doc.setFontSize(8);

        // Data rows
        for (let j = 0; j < receipt.config.items.length; j++) {
          const item = receipt.config.items[j];
          const rowH = 6;

          doc.rect(tableX, y, colWidths[0], rowH);
          doc.rect(tableX + colWidths[0], y, colWidths[1], rowH);
          doc.rect(
            tableX + colWidths[0] + colWidths[1],
            y,
            colWidths[2] / 2,
            rowH
          );
          doc.rect(
            tableX + colWidths[0] + colWidths[1] + colWidths[2] / 2,
            y,
            colWidths[2] / 2,
            rowH
          );

          doc.text(String(j + 1), tableX + colWidths[0] / 2, y + 4, {
            align: "center",
          });
          doc.text(item.name, tableX + colWidths[0] + 2, y + 4);
          doc.text(
            item.amount.toLocaleString(),
            tableX + colWidths[0] + colWidths[1] + colWidths[2] / 4,
            y + 4,
            { align: "center" }
          );
          doc.text(
            "-",
            tableX + colWidths[0] + colWidths[1] + (colWidths[2] * 3) / 4,
            y + 4,
            { align: "center" }
          );

          y += rowH;
        }

        // Total row
        const totalRowH = 6;
        doc.rect(tableX, y, colWidths[0] + colWidths[1], totalRowH);
        doc.rect(
          tableX + colWidths[0] + colWidths[1],
          y,
          colWidths[2] / 2,
          totalRowH
        );
        doc.rect(
          tableX + colWidths[0] + colWidths[1] + colWidths[2] / 2,
          y,
          colWidths[2] / 2,
          totalRowH
        );

        doc.setFontSize(8);
        doc.text(
          "รวมเงินทั้งสิ้น (บาท)",
          tableX + (colWidths[0] + colWidths[1]) / 2,
          y + 4,
          { align: "center" }
        );
        doc.text(
          receipt.config.total.toLocaleString(),
          tableX + colWidths[0] + colWidths[1] + colWidths[2] / 4,
          y + 4,
          { align: "center" }
        );
        doc.text(
          "-",
          tableX + colWidths[0] + colWidths[1] + (colWidths[2] * 3) / 4,
          y + 4,
          { align: "center" }
        );

        y += totalRowH + 4;

        // Thai baht text
        doc.setFontSize(8);
        const bahtText = THBText(receipt.config.total);
        doc.text(`ตัวอักษร (${bahtText})`, offsetX + 5, y);

        y += 10;
        doc.text(
          "ลงชื่อ..........................................................ผู้รับเงิน",
          offsetX + receiptWidth / 2,
          y,
          { align: "center" }
        );
      }
    }

    doc.save("ใบเสร็จรับเงินชั่วคราว.pdf");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">พิมพ์ใบเสร็จรับเงินชั่วคราว</h1>
        <Button
          onClick={handleGenerate}
          disabled={generating || selected.size === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          {generating
            ? "กำลังสร้าง..."
            : `สร้าง PDF (${selected.size} ใบ)`}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ หรือ เลขประจำตัว..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="ทุกประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                <SelectItem value="M1">ม.1</SelectItem>
                <SelectItem value="M4_GENERAL">ม.4 ทั่วไป</SelectItem>
                <SelectItem value="M4_LANG">ม.4 อังกฤษ จีน ญี่ปุ่น</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      students.length > 0 && selected.size === students.length
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>เลขประจำตัว</TableHead>
                <TableHead>ชื่อ-นามสกุล</TableHead>
                <TableHead>ชั้น/ห้อง</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() => toggleOne(s.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{s.studentCode}</TableCell>
                  <TableCell>
                    {s.prefix}
                    {s.firstName} {s.lastName}
                  </TableCell>
                  <TableCell>
                    {s.level}/{s.room}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {receiptTypeLabels[s.receiptType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.receipts.length > 0 ? (
                      <Badge className="bg-green-100 text-green-700">
                        <FileText className="w-3 h-3 mr-1" />
                        พิมพ์แล้ว
                      </Badge>
                    ) : (
                      <Badge variant="secondary">ยังไม่พิมพ์</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {students.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    ยังไม่มีข้อมูลนักเรียน
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
