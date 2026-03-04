"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Search, Download } from "lucide-react";
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

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [receiptType, setReceiptType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    loadStudents();
  }, [search, filterType]);

  async function loadStudents() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterType) params.set("receiptType", filterType);
    const res = await fetch(`/api/students?${params}`);
    const data = await res.json();
    setStudents(data);
  }

  async function handleUpload() {
    if (!file || !receiptType) {
      toast.error("กรุณาเลือกไฟล์และประเภทใบเสร็จ");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiptType", receiptType);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error);
        return;
      }

      toast.success(
        `นำเข้าสำเร็จ ${data.imported} คน${
          data.duplicates > 0 ? ` (ซ้ำ ${data.duplicates} คน)` : ""
        }`
      );
      setFile(null);
      loadStudents();
    } catch {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`ต้องการลบข้อมูล "${name}" หรือไม่?`)) return;

    const res = await fetch("/api/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      toast.success("ลบข้อมูลสำเร็จ");
      loadStudents();
    } else {
      toast.error("ไม่สามารถลบได้");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">นำเข้าข้อมูลนักเรียน</h1>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">อัปโหลดไฟล์ Excel</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                คอลัมน์: เลขประจำตัว | คำนำหน้า | ชื่อ | นามสกุล | ชั้น | ห้อง
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="/api/import/template" download>
                <Download className="w-4 h-4 mr-2" />
                ดาวน์โหลด Template
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>ไฟล์ Excel (.xlsx)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="w-full md:w-64 space-y-2">
              <Label>ประเภทใบเสร็จ</Label>
              <Select value={receiptType} onValueChange={setReceiptType}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M1">ม.1</SelectItem>
                  <SelectItem value="M4_GENERAL">ม.4 ทั่วไป</SelectItem>
                  <SelectItem value="M4_LANG">ม.4 อังกฤษ จีน ญี่ปุ่น</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpload} disabled={uploading || !file}>
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "กำลังนำเข้า..." : "นำเข้า"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            รายชื่อนักเรียน ({students.length} คน)
          </CardTitle>
          <div className="flex flex-col md:flex-row gap-3 mt-3">
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
                <TableHead>เลขประจำตัว</TableHead>
                <TableHead>ชื่อ-นามสกุล</TableHead>
                <TableHead>ชั้น/ห้อง</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>ใบเสร็จ</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
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
                        พิมพ์แล้ว
                      </Badge>
                    ) : (
                      <Badge variant="secondary">ยังไม่พิมพ์</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleDelete(
                          s.id,
                          `${s.firstName} ${s.lastName}`
                        )
                      }
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
