"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { FilePlus2, Search, Loader2, FileDown, AlertTriangle, Trash2, X, Ban } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  M4_ENGLISH: "ม.4 อังกฤษ",
  M4_CHINESE: "ม.4 จีน",
  M4_JAPANESE: "ม.4 ญี่ปุ่น",
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

export default function CreateReceiptClient({ isAdmin }: { isAdmin: boolean }) {
  const [form, setForm] = useState(initialForm);
  const [receiptDate, setReceiptDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [looking, setLooking] = useState(false);
  const [foundStudent, setFoundStudent] = useState(false);
  const [underpaid, setUnderpaid] = useState<UnderpaidRecord[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  // ยกเลิกใบเสร็จ
  type CancellableReceipt = {
    id: string;
    receiptNumber: string;
    receiptType: string;
    totalAmount: number;
    paidAt: string | null;
    generatedAt: string;
    student: { studentCode: string; prefix: string; firstName: string; lastName: string; level: string; room: string };
  };
  const [activeTab, setActiveTab] = useState("create");
  const [cancelSearch, setCancelSearch] = useState("");
  const [cancelResults, setCancelResults] = useState<CancellableReceipt[]>([]);
  const [cancelSearching, setCancelSearching] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<CancellableReceipt | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const cancelSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCancelSearch = useCallback((query: string) => {
    if (cancelSearchTimerRef.current) clearTimeout(cancelSearchTimerRef.current);
    if (query.trim().length < 2) {
      setCancelResults([]);
      return;
    }
    cancelSearchTimerRef.current = setTimeout(async () => {
      setCancelSearching(true);
      try {
        const res = await fetch(`/api/receipts/search?search=${encodeURIComponent(query.trim())}`);
        if (res.ok) setCancelResults(await res.json());
      } catch { /* ignore */ }
      finally { setCancelSearching(false); }
    }, 300);
  }, []);

  function openCancelDialog(r: CancellableReceipt) {
    setSelectedReceipt(r);
    setCancelReason("");
  }

  async function confirmCancel() {
    if (!selectedReceipt) return;
    if (!cancelReason.trim()) {
      toast.error("กรุณาระบุเหตุผลในการยกเลิก");
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch("/api/receipts/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId: selectedReceipt.id, reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "ยกเลิกใบเสร็จไม่สำเร็จ");
        return;
      }
      toast.success(`ยกเลิกใบเสร็จ ${selectedReceipt.receiptNumber} เรียบร้อยแล้ว`);
      setSelectedReceipt(null);
      setCancelReason("");
      // รีเฟรชผลการค้นหา
      if (cancelSearch.trim().length >= 2) debouncedCancelSearch(cancelSearch);
      // รีเฟรชรายงานชำระไม่ครบ
      loadUnderpaid();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการยกเลิก");
    } finally {
      setCancelling(false);
    }
  }
  // ค้นหาด้วยชื่อ/นามสกุล
  type SearchStudent = { id: string; studentCode: string; prefix: string; firstName: string; lastName: string; level: string; room: string; receiptType: string };
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const debouncedSearch = useCallback((query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(query.trim())}&limit=10&page=1`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.students || []);
          setShowDropdown(true);
        }
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
  }, []);

  function selectStudent(s: SearchStudent) {
    setForm((prev) => ({
      ...prev,
      studentCode: s.studentCode,
      prefix: s.prefix,
      firstName: s.firstName,
      lastName: s.lastName,
      level: s.level,
      room: s.room,
      receiptType: s.receiptType,
    }));
    setFoundStudent(true);
    setShowDropdown(false);
    setSearchResults([]);
    toast.success(`พบข้อมูล: ${s.prefix}${s.firstName} ${s.lastName}`);
  }

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create" className="gap-2">
            <FilePlus2 className="w-4 h-4" />
            สร้างใบเสร็จ
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="cancel" className="gap-2">
              <Ban className="w-4 h-4" />
              ยกเลิกใบเสร็จ
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="create" className="space-y-6 mt-6">
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
          {/* Student Code with Lookup + Name Search */}
          <div className="space-y-2">
            <Label>ค้นหานักเรียน</Label>
            <div className="relative" ref={dropdownRef}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="เลขประจำตัว, ชื่อ หรือ นามสกุล"
                    value={form.studentCode}
                    onChange={(e) => {
                      updateField("studentCode", e.target.value);
                      setFoundStudent(false);
                      debouncedSearch(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setShowDropdown(false);
                    }}
                    onBlur={() => {
                      // delay เพื่อให้คลิก dropdown ได้ก่อน blur ปิด
                      setTimeout(() => {
                        if (!showDropdown) handleLookup();
                      }, 200);
                    }}
                  />
                  {searching && (
                    <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  )}
                </div>
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
              {/* Dropdown ผลการค้นหา */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {searchResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectStudent(s)}
                    >
                      <div className="font-medium text-sm">
                        {s.prefix}{s.firstName} {s.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        เลขประจำตัว: {s.studentCode} | ชั้น ม.{s.level}/{s.room} | {receiptTypeLabels[s.receiptType] || s.receiptType}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && searchResults.length === 0 && !searching && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg p-3 text-sm text-muted-foreground text-center">
                  ไม่พบข้อมูลนักเรียน
                </div>
              )}
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
                  <SelectItem value="M4_ENGLISH">ม.4 อังกฤษ</SelectItem>
                  <SelectItem value="M4_CHINESE">ม.4 จีน</SelectItem>
                  <SelectItem value="M4_JAPANESE">ม.4 ญี่ปุ่น</SelectItem>
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
        </TabsContent>

        {isAdmin && (
          <TabsContent value="cancel" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ban className="w-5 h-5 text-red-600" />
                  ค้นหาใบเสร็จที่ต้องการยกเลิก
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  ค้นหาด้วยเลขที่ใบเสร็จ, เลขประจำตัวนักเรียน หรือชื่อ-นามสกุล (การยกเลิกจะลบใบเสร็จออกจากระบบถาวร แต่จะบันทึก log การยกเลิกไว้)
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="เลขที่ใบเสร็จ, เลขประจำตัว, ชื่อ หรือ นามสกุล"
                    className="pl-9"
                    value={cancelSearch}
                    onChange={(e) => {
                      setCancelSearch(e.target.value);
                      debouncedCancelSearch(e.target.value);
                    }}
                  />
                  {cancelSearching && (
                    <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  )}
                </div>

                {cancelSearch.trim().length < 2 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา
                  </p>
                ) : cancelResults.length === 0 && !cancelSearching ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    ไม่พบใบเสร็จที่ตรงกับคำค้นหา
                  </p>
                ) : cancelResults.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เลขที่ใบเสร็จ</TableHead>
                        <TableHead>เลขประจำตัว</TableHead>
                        <TableHead>ชื่อ-สกุล</TableHead>
                        <TableHead>ชั้น/ห้อง</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead className="text-right">ยอดเงิน</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cancelResults.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-sm">{r.receiptNumber}</TableCell>
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
                          <TableCell className="text-right">
                            {r.totalAmount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {r.paidAt ? (
                              <Badge className="bg-green-100 text-green-700">ชำระแล้ว</Badge>
                            ) : (
                              <Badge variant="destructive">ยังไม่ชำระ</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => openCancelDialog(r)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              ยกเลิก
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog ยืนยันการยกเลิก */}
      <Dialog open={!!selectedReceipt} onOpenChange={(open) => { if (!open) setSelectedReceipt(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              ยืนยันการยกเลิกใบเสร็จ
            </DialogTitle>
            <DialogDescription>
              การยกเลิกจะลบใบเสร็จนี้ออกจากระบบถาวร ไม่สามารถกู้คืนได้ (ระบบจะบันทึก log การยกเลิกไว้เพื่อตรวจสอบ)
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-md p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เลขที่ใบเสร็จ:</span>
                  <span className="font-mono font-medium">{selectedReceipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">นักเรียน:</span>
                  <span className="font-medium">
                    {selectedReceipt.student.prefix}{selectedReceipt.student.firstName} {selectedReceipt.student.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เลขประจำตัว:</span>
                  <span className="font-mono">{selectedReceipt.student.studentCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดเงิน:</span>
                  <span className="font-medium">{selectedReceipt.totalAmount.toLocaleString()} บาท</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  เหตุผลในการยกเลิก <span className="text-red-500">*</span>
                </Label>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="เช่น: บันทึกข้อมูลผิดพลาด, นักเรียนขอเปลี่ยนประเภท, ยกเลิกการชำระ..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  disabled={cancelling}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedReceipt(null)}
              disabled={cancelling}
            >
              <X className="w-4 h-4 mr-2" />
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelling || !cancelReason.trim()}
            >
              {cancelling ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {cancelling ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
