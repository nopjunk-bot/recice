"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ScanBarcode,
  CheckCircle2,
  XCircle,
  Trash2,
  AlertTriangle,
  Banknote,
  UserX,
  Search,
} from "lucide-react";
import { toast } from "sonner";

type StudentInfo = {
  id: string;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
  receiptType: string;
};

type ScanResult = {
  student: StudentInfo;
  receipt: {
    receiptNumber: string;
    totalAmount: number;
    paidAt: string;
  };
  alreadyPaid: boolean;
};

type ScanRecord = {
  student: StudentInfo;
  totalAmount: number;
  time: string;
  alreadyPaid: boolean;
};

type UnpaidStudent = {
  id: string;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
  receiptType: string;
  receipts: { id: string; paidAt: string | null; totalAmount: number }[];
};

const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_LANG: "ม.4 อังกฤษ จีน ญี่ปุ่น",
};

export default function PaymentScanPage() {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Unpaid students tab state
  const [unpaidStudents, setUnpaidStudents] = useState<UnpaidStudent[]>([]);
  const [unpaidSearch, setUnpaidSearch] = useState("");
  const [unpaidLoading, setUnpaidLoading] = useState(false);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("scan");

  // Auto-focus input on mount and tab change
  useEffect(() => {
    if (activeTab === "scan") {
      inputRef.current?.focus();
    }
  }, [activeTab]);

  // Load unpaid students when tab changes
  useEffect(() => {
    if (activeTab === "unpaid") {
      loadUnpaidStudents();
    }
  }, [activeTab]);

  const focusInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
  }, []);

  function playBeep(success: boolean) {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = success ? 800 : 300;
      oscillator.type = "sine";
      gain.gain.value = 0.3;
      oscillator.start();
      oscillator.stop(ctx.currentTime + (success ? 0.15 : 0.3));
    } catch {
      // Audio not supported
    }
  }

  async function handleScan() {
    if (!barcode.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/payment-scan?barcode=${encodeURIComponent(barcode.trim())}`
      );
      const data: ScanResult & { error?: string } = await res.json();

      if (!res.ok) {
        toast.error(data.error || "เกิดข้อผิดพลาด");
        playBeep(false);
        setBarcode("");
        focusInput();
        return;
      }

      if (data.alreadyPaid) {
        toast.warning(
          `${data.student.prefix}${data.student.firstName} ${data.student.lastName} ชำระเงินแล้ว`,
          { duration: 3000 }
        );
        playBeep(false);
      } else {
        toast.success(
          `ชำระเงินสำเร็จ: ${data.student.prefix}${data.student.firstName} ${data.student.lastName} (${data.receipt.totalAmount.toLocaleString()} บาท)`,
          { duration: 3000 }
        );
        playBeep(true);
      }

      // Add to history (newest first)
      setScanHistory((prev) => [
        {
          student: data.student,
          totalAmount: data.receipt.totalAmount,
          time: new Date().toLocaleTimeString("th-TH"),
          alreadyPaid: data.alreadyPaid,
        },
        ...prev,
      ]);

      setBarcode("");
      focusInput();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      playBeep(false);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleScan();
    }
  }

  // Unpaid students functions
  async function loadUnpaidStudents() {
    setUnpaidLoading(true);
    try {
      const res = await fetch("/api/payment-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unpaid-list",
          search: unpaidSearch || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUnpaidStudents(data.students);
        setTotalUnpaid(data.totalUnpaid);
      }
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setUnpaidLoading(false);
    }
  }

  // Debounced search for unpaid students
  useEffect(() => {
    if (activeTab !== "unpaid") return;
    const timer = setTimeout(() => {
      loadUnpaidStudents();
    }, 400);
    return () => clearTimeout(timer);
  }, [unpaidSearch]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === unpaidStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unpaidStudents.map((s) => s.id)));
    }
  }

  async function handleDeleteUnpaid() {
    setDeleting(true);
    try {
      const res = await fetch("/api/payment-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-unpaid",
          studentIds: Array.from(selectedIds),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error);
        return;
      }

      toast.success(data.message);
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      loadUnpaidStudents();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setDeleting(false);
    }
  }

  const paidCount = scanHistory.filter((r) => !r.alreadyPaid).length;
  const totalPaidAmount = scanHistory
    .filter((r) => !r.alreadyPaid)
    .reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="w-7 h-7 text-green-600" />
            สแกนชำระเงิน
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            สแกน Barcode ใบเสร็จเพื่อบันทึกการชำระเงิน (บันทึกอัตโนมัติ)
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="scan" className="gap-2">
            <ScanBarcode className="w-4 h-4" />
            สแกนชำระเงิน
          </TabsTrigger>
          <TabsTrigger value="unpaid" className="gap-2">
            <UserX className="w-4 h-4" />
            นักเรียนยังไม่ชำระ
            {totalUnpaid > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {totalUnpaid}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Scan Payment */}
        <TabsContent value="scan" className="space-y-4 mt-4">
          {/* Scan Input */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <ScanBarcode className="absolute left-3 top-2.5 w-5 h-5 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    placeholder="สแกน Barcode ใบเสร็จ หรือพิมพ์เลขประจำตัว แล้วกด Enter..."
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-11 text-lg h-12"
                    autoFocus
                    disabled={loading}
                  />
                </div>
                <Button
                  onClick={handleScan}
                  className="h-12 px-6"
                  disabled={loading || !barcode.trim()}
                >
                  <ScanBarcode className="w-4 h-4 mr-2" />
                  {loading ? "กำลังค้นหา..." : "สแกน"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          {scanHistory.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {paidCount}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ชำระเงินแล้ววันนี้
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {totalPaidAmount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ยอดรวม (บาท)
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Scan History - Right Side */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Banknote className="w-5 h-5" />
                รายการที่สแกนแล้ว
              </CardTitle>
              <CardDescription>
                แสดงนักเรียนที่สแกนชำระเงินแล้ว (เรียงจากล่าสุด)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scanHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ScanBarcode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">พร้อมสแกน Barcode</p>
                  <p className="text-sm mt-1">
                    สแกน Barcode ใบเสร็จเพื่อบันทึกการชำระเงินอัตโนมัติ
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>เลขประจำตัว</TableHead>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>ชั้น/ห้อง</TableHead>
                      <TableHead className="text-right">จำนวนเงิน</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>เวลา</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanHistory.map((record, i) => (
                      <TableRow
                        key={i}
                        className={
                          record.alreadyPaid ? "bg-yellow-50" : "bg-green-50"
                        }
                      >
                        <TableCell className="font-mono text-muted-foreground">
                          {scanHistory.length - i}
                        </TableCell>
                        <TableCell className="font-mono font-bold">
                          {record.student.studentCode}
                        </TableCell>
                        <TableCell>
                          {record.student.prefix}
                          {record.student.firstName} {record.student.lastName}
                        </TableCell>
                        <TableCell>
                          {record.student.level}/{record.student.room}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {record.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {record.alreadyPaid ? (
                            <Badge
                              variant="outline"
                              className="text-yellow-700 border-yellow-300 bg-yellow-100"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              ชำระแล้วก่อนหน้า
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 border-green-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              ชำระสำเร็จ
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Unpaid Students */}
        <TabsContent value="unpaid" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="destructive"
              disabled={selectedIds.size === 0}
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              ลบที่เลือก ({selectedIds.size} คน)
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                นักเรียนที่ยังไม่ชำระเงิน
              </CardTitle>
              <CardDescription>
                รายชื่อนักเรียนที่มีใบเสร็จแต่ยังไม่ได้ชำระเงิน
                หรือยังไม่มีใบเสร็จ
              </CardDescription>
              <div className="mt-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อ หรือ เลขประจำตัว..."
                    value={unpaidSearch}
                    onChange={(e) => setUnpaidSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {unpaidLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  กำลังโหลด...
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={
                                unpaidStudents.length > 0 &&
                                selectedIds.size === unpaidStudents.length
                              }
                              onCheckedChange={selectAll}
                            />
                          </div>
                        </TableHead>
                        <TableHead>เลขประจำตัว</TableHead>
                        <TableHead>ชื่อ-นามสกุล</TableHead>
                        <TableHead>ชั้น/ห้อง</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead>สถานะใบเสร็จ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unpaidStudents.map((s) => (
                        <TableRow
                          key={s.id}
                          className={selectedIds.has(s.id) ? "bg-red-50" : ""}
                        >
                          <TableCell>
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={selectedIds.has(s.id)}
                                onCheckedChange={() => toggleSelect(s.id)}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {s.studentCode}
                          </TableCell>
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
                            {s.receipts.length === 0 ? (
                              <Badge variant="secondary">ยังไม่มีใบเสร็จ</Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-orange-700 border-orange-300"
                              >
                                ยังไม่ชำระเงิน
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {unpaidStudents.length === 0 && !unpaidLoading && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-8 text-muted-foreground"
                          >
                            {unpaidSearch
                              ? "ไม่พบนักเรียนที่ตรงกับคำค้นหา"
                              : "ไม่มีนักเรียนที่ยังไม่ชำระเงิน"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {unpaidStudents.length > 0 && (
                    <div className="flex items-center gap-3 mt-4 text-sm text-muted-foreground">
                      <span>
                        แสดง {unpaidStudents.length} จาก {totalUnpaid} คน
                      </span>
                      {selectedIds.size > 0 && (
                        <span className="text-red-600 font-medium">
                          เลือกแล้ว {selectedIds.size} คน
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              ยืนยันการลบนักเรียนที่ยังไม่ชำระเงิน
            </DialogTitle>
            <DialogDescription>
              คุณกำลังจะลบข้อมูลนักเรียน{" "}
              <strong>{selectedIds.size} คน</strong> ที่ยังไม่ชำระเงินอย่างถาวร
              ข้อมูลที่เกี่ยวข้องทั้งหมด (ใบเสร็จ, ข้อมูลสวัสดิการ)
              จะถูกลบไปด้วย
              <br />
              <span className="text-red-600 font-medium">
                การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUnpaid}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleting ? "กำลังลบ..." : `ลบ ${selectedIds.size} คน`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
