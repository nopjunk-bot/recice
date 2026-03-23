"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FilePlus2, Search, Loader2, FileDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { generateReceiptPDF, generateUnderpaidReportPDF } from "@/lib/pdf-generator";

type UnderpaidRecord = {
  id: string;
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
  M4_LANG: "ม.4 ภาษา",
};

const initialForm = {
  studentCode: "",
  prefix: "",
  firstName: "",
  lastName: "",
  level: "",
  room: "",
  receiptType: "",
  amount: "",
};

export default function CreateReceiptPage() {
  const [form, setForm] = useState(initialForm);
  const [receiptDate, setReceiptDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [looking, setLooking] = useState(false);
  const [foundStudent, setFoundStudent] = useState(false);
  const [underpaid, setUnderpaid] = useState<UnderpaidRecord[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  async function loadUnderpaid() {
    setLoadingReport(true);
    try {
      const res = await fetch("/api/receipts/underpaid");
      if (res.ok) setUnderpaid(await res.json());
    } catch { /* ignore */ }
    finally { setLoadingReport(false); }
  }

  useEffect(() => { loadUnderpaid(); }, []);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleLookup() {
    const code = form.studentCode.trim();
    if (!code) return;

    setLooking(true);
    try {
      const res = await fetch(`/api/students/lookup?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        const s = data.student;
        setForm((prev) => ({
          ...prev,
          prefix: s.prefix,
          firstName: s.firstName,
          lastName: s.lastName,
          level: s.level,
          room: s.room,
          receiptType: s.receiptType,
        }));
        setFoundStudent(true);
        toast.success(`พบข้อมูล: ${s.prefix}${s.firstName} ${s.lastName}`);
      } else {
        setFoundStudent(false);
      }
    } catch {
      // ignore - student not found
    } finally {
      setLooking(false);
    }
  }

  async function handleSubmit() {
    // Validate
    if (!form.studentCode || !form.prefix || !form.firstName || !form.lastName || !form.level || !form.room || !form.receiptType) {
      toast.error("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error("กรุณากรอกจำนวนเงินที่ถูกต้อง");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/receipts/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentCode: form.studentCode.trim(),
          prefix: form.prefix,
          firstName: form.firstName,
          lastName: form.lastName,
          level: form.level,
          room: form.room,
          receiptType: form.receiptType,
          amount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      // Generate and download PDF
      const dateStr = format(receiptDate, "yyyy-MM-dd");
      generateReceiptPDF([data.receipt], dateStr);

      toast.success(`สร้างใบเสร็จสำเร็จ: ${data.receipt.receiptNumber}`);

      // Reset form + reload report
      setForm(initialForm);
      setReceiptDate(new Date());
      setFoundStudent(false);
      loadUnderpaid();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการสร้างใบเสร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">พิมพ์ใบเสร็จรับเงินชั่วคราว</h1>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium whitespace-nowrap">
          วันที่ในใบเสร็จ
        </label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-64 justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(receiptDate, "d MMMM yyyy", { locale: th })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={receiptDate}
              onSelect={(date) => {
                if (date) {
                  setReceiptDate(date);
                  setCalendarOpen(false);
                }
              }}
              locale={th}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">กรอกข้อมูลนักเรียน</CardTitle>
          <p className="text-sm text-muted-foreground">
            กรอกข้อมูลนักเรียนและจำนวนเงินเพื่อสร้างใบเสร็จชั่วคราว
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Student Code with Lookup */}
          <div className="space-y-2">
            <Label>เลขประจำตัวนักเรียน</Label>
            <div className="flex gap-2">
              <Input
                placeholder="เช่น 12345"
                value={form.studentCode}
                onChange={(e) => {
                  updateField("studentCode", e.target.value);
                  setFoundStudent(false);
                }}
                onBlur={handleLookup}
              />
              <Button
                variant="outline"
                onClick={handleLookup}
                disabled={looking || !form.studentCode.trim()}
              >
                {looking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
            {foundStudent && (
              <p className="text-xs text-green-600">
                พบข้อมูลนักเรียนในระบบ - ดึงข้อมูลมาเติมให้แล้ว (แก้ไขได้)
              </p>
            )}
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>คำนำหน้า</Label>
              <Select value={form.prefix} onValueChange={(v) => updateField("prefix", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกคำนำหน้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="เด็กชาย">เด็กชาย</SelectItem>
                  <SelectItem value="เด็กหญิง">เด็กหญิง</SelectItem>
                  <SelectItem value="นาย">นาย</SelectItem>
                  <SelectItem value="นางสาว">นางสาว</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ชื่อ</Label>
              <Input
                placeholder="ชื่อ"
                value={form.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>นามสกุล</Label>
              <Input
                placeholder="นามสกุล"
                value={form.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
              />
            </div>
          </div>

          {/* Level, Room, Receipt Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>ชั้น</Label>
              <Input
                placeholder="เช่น ม.1"
                value={form.level}
                onChange={(e) => updateField("level", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ห้อง</Label>
              <Input
                placeholder="เช่น 1"
                value={form.room}
                onChange={(e) => updateField("room", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ประเภทใบเสร็จ</Label>
              <Select value={form.receiptType} onValueChange={(v) => updateField("receiptType", v)}>
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
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>จำนวนเงิน (บาท)</Label>
            <Input
              type="number"
              placeholder="เช่น 4250"
              min="1"
              value={form.amount}
              onChange={(e) => updateField("amount", e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full md:w-auto"
            size="lg"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FilePlus2 className="w-4 h-4 mr-2" />
            )}
            {loading ? "กำลังสร้างใบเสร็จ..." : "สร้างใบเสร็จและดาวน์โหลด PDF"}
          </Button>
        </CardContent>
      </Card>
      {/* ─── รายงานชำระไม่ครบ ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              นักเรียนที่ชำระเงินไม่ครบจำนวน ({underpaid.length} คน)
            </CardTitle>
            {underpaid.length > 0 && (
              <Button
                variant="outline"
                onClick={() => generateUnderpaidReportPDF(underpaid)}
              >
                <FileDown className="w-4 h-4 mr-2" />
                ดาวน์โหลด PDF
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingReport ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              กำลังโหลด...
            </div>
          ) : underpaid.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              ไม่มีนักเรียนที่ชำระไม่ครบ
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขประจำตัว</TableHead>
                  <TableHead>ชื่อ-สกุล</TableHead>
                  <TableHead>ชั้น/ห้อง</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">ยอดชำระ</TableHead>
                  <TableHead className="text-right">ยอดเต็ม</TableHead>
                  <TableHead className="text-right">ส่วนต่าง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {underpaid.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.student.studentCode}</TableCell>
                    <TableCell>
                      {r.student.prefix}{r.student.firstName} {r.student.lastName}
                    </TableCell>
                    <TableCell>{r.student.level}/{r.student.room}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {receiptTypeLabels[r.receiptType] || r.receiptType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.paidAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.expectedAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      -{r.difference.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50 font-bold">
                  <TableCell colSpan={6} className="text-right">รวมส่วนต่างทั้งหมด</TableCell>
                  <TableCell className="text-right text-red-600">
                    -{underpaid.reduce((sum, r) => sum + r.difference, 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
