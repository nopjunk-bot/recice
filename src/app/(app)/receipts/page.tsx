"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  _count: { receipts: number };
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
  const [filterRoom, setFilterRoom] = useState("");
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [receiptDate, setReceiptDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // YYYY-MM-DD
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input - รอ 400ms หลังพิมพ์เสร็จค่อย query
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  }, []);

  useEffect(() => {
    loadStudents();
  }, [debouncedSearch, filterType, filterRoom]);

  async function loadStudents() {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterType && filterType !== "all") params.set("receiptType", filterType);
    if (filterRoom && filterRoom !== "all") params.set("room", filterRoom);
    params.set("includeRooms", "true");
    const res = await fetch(`/api/students?${params}`);
    const data = await res.json();
    setStudents(data.students);
    if (data.rooms) setAvailableRooms(data.rooms);
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
      await generatePDF(data.receipts, receiptDate);
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
    }[],
    dateStr: string
  ) {
    const { generateReceiptPDF } = await import("@/lib/pdf-generator");
    generateReceiptPDF(receipts, dateStr);
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

      <div className="flex items-center gap-3">
        <label htmlFor="receiptDate" className="text-sm font-medium whitespace-nowrap">
          วันที่ในใบเสร็จ
        </label>
        <Input
          id="receiptDate"
          type="date"
          value={receiptDate}
          onChange={(e) => setReceiptDate(e.target.value)}
          className="w-48"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ หรือ เลขประจำตัว..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="ทุกประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                <SelectItem value="M1">ม.1</SelectItem>
                <SelectItem value="M4_GENERAL">ม.4 ทั่วไป</SelectItem>
                <SelectItem value="M4_LANG">ม.4 อังกฤษ จีน ญี่ปุ่น</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRoom} onValueChange={setFilterRoom}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="ทุกห้อง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกห้อง</SelectItem>
                {availableRooms.map((room) => (
                  <SelectItem key={room} value={room}>
                    ห้อง {room}
                  </SelectItem>
                ))}
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
                    {s._count.receipts > 0 ? (
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
