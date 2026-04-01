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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ClipboardCheck,
  UserX,
  Search,
  AlertTriangle,
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
  };
  status: "confirmed_unpaid" | "already_confirmed" | "already_paid";
  error?: string;
};

type ScanRecord = {
  student: StudentInfo;
  totalAmount: number;
  time: string;
  status: "confirmed_unpaid" | "already_confirmed" | "already_paid";
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
  receipts: {
    id: string;
    paidAt: string | null;
    totalAmount: number;
    unpaidConfirmedAt: string | null;
    unpaidConfirmedBy: { name: string } | null;
  }[];
};

const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_ENGLISH: "ม.4 อังกฤษ",
  M4_CHINESE: "ม.4 จีน",
  M4_JAPANESE: "ม.4 ญี่ปุ่น",
};

export default function PaymentScanPage() {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({
    code: "",
    time: 0,
  });

  // Unpaid students tab state
  const [unpaidStudents, setUnpaidStudents] = useState<UnpaidStudent[]>([]);
  const [unpaidSearch, setUnpaidSearch] = useState("");
  const [unpaidLoading, setUnpaidLoading] = useState(false);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [totalConfirmed, setTotalConfirmed] = useState(0);
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
    inputRef.current?.focus();
    inputRef.current?.select();
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
    const trimmed = barcode.trim();
    if (!trimmed) return;

    // Prevent double-scan within 500ms
    const now = Date.now();
    if (
      trimmed === lastScanRef.current.code &&
      now - lastScanRef.current.time < 500
    ) {
      setBarcode("");
      focusInput();
      return;
    }
    lastScanRef.current = { code: trimmed, time: now };

    // Optimistic: clear input immediately for faster scanning
    setBarcode("");
    setLoading(true);

    try {
      const res = await fetch(
        `/api/payment-scan?barcode=${encodeURIComponent(trimmed)}`
      );
      const data: ScanResult = await res.json();

      if (!res.ok) {
        toast.error(data.error || "เกิดข้อผิดพลาด");
        playBeep(false);
        focusInput();
        return;
      }

      const fullName = `${data.student.prefix}${data.student.firstName} ${data.student.lastName}`;

      if (data.status === "already_paid") {
        toast.info(`${fullName} — ชำระเงินแล้ว ไม่ต้องดำเนินการ`, {
          duration: 3000,
        });
        playBeep(false);
      } else if (data.status === "already_confirmed") {
        toast.warning(`${fullName} — ยืนยันค้างชำระแล้วก่อนหน้า`, {
          duration: 3000,
        });
        playBeep(false);
      } else {
        toast.success(
          `ยืนยันค้างชำระสำเร็จ: ${fullName} (${data.receipt.totalAmount.toLocaleString()} บาท)`,
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
          status: data.status,
        },
        ...prev,
      ]);

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
        setTotalConfirmed(data.totalConfirmed);
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

  const confirmedCount = scanHistory.filter(
    (r) => r.status === "confirmed_unpaid"
  ).length;
  const totalUnpaidAmount = scanHistory
    .filter((r) => r.status === "confirmed_unpaid")
    .reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-orange-600" />
            ยืนยันค้างชำระ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            สแกน Barcode เพื่อยืนยันว่านักเรียนยังไม่ชำระเงิน
            (ส่งข้อมูลให้ฝ่ายวิชาการ)
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="scan" className="gap-2">
            <ScanBarcode className="w-4 h-4" />
            สแกนยืนยัน
          </TabsTrigger>
          <TabsTrigger value="unpaid" className="gap-2">
            <UserX className="w-4 h-4" />
            รายงานค้างชำระ
            {totalUnpaid > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {totalUnpaid}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Scan Confirm Unpaid */}
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
                  className="h-12 px-6 bg-orange-600 hover:bg-orange-700"
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
                  <p className="text-3xl font-bold text-orange-600">
                    {confirmedCount}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ยืนยันค้างชำระแล้ว
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-red-600">
                    {totalUnpaidAmount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ยอดค้างชำระรวม (บาท)
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Scan History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5" />
                รายการที่สแกนแล้ว
              </CardTitle>
              <CardDescription>
                แสดงนักเรียนที่สแกนยืนยันค้างชำระแล้ว (เรียงจากล่าสุด)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scanHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ScanBarcode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">พร้อมสแกน Barcode</p>
                  <p className="text-sm mt-1">
                    สแกน Barcode ใบเสร็จเพื่อยืนยันว่านักเรียนยังไม่ชำระเงิน
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
                          record.status === "confirmed_unpaid"
                            ? "bg-orange-50"
                            : record.status === "already_confirmed"
                            ? "bg-yellow-50"
                            : "bg-green-50"
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
                          {record.status === "confirmed_unpaid" ? (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              ยืนยันค้างชำระ
                            </Badge>
                          ) : record.status === "already_confirmed" ? (
                            <Badge
                              variant="outline"
                              className="text-yellow-700 border-yellow-300 bg-yellow-100"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              ยืนยันแล้วก่อนหน้า
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 border-green-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              ชำระเงินแล้ว
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

        {/* Tab: Unpaid Students Report */}
        <TabsContent value="unpaid" className="space-y-4 mt-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-red-600">
                  {totalUnpaid}
                </p>
                <p className="text-sm text-muted-foreground">
                  ค้างชำระทั้งหมด
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-orange-600">
                  {totalConfirmed}
                </p>
                <p className="text-sm text-muted-foreground">
                  ยืนยันแล้ว
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-gray-600">
                  {totalUnpaid - totalConfirmed}
                </p>
                <p className="text-sm text-muted-foreground">
                  ยังไม่ยืนยัน
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                รายงานนักเรียนค้างชำระเงิน
              </CardTitle>
              <CardDescription>
                รายชื่อนักเรียนที่ยังไม่ชำระเงิน
                พร้อมสถานะการยืนยันจากผู้ดูแลระบบ
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
                        <TableHead>เลขประจำตัว</TableHead>
                        <TableHead>ชื่อ-นามสกุล</TableHead>
                        <TableHead>ชั้น/ห้อง</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead>สถานะใบเสร็จ</TableHead>
                        <TableHead>สถานะยืนยัน</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unpaidStudents.map((s) => {
                        const receipt = s.receipts[0];
                        return (
                          <TableRow key={s.id}>
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
                              {!receipt ? (
                                <Badge variant="secondary">
                                  ยังไม่มีใบเสร็จ
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-orange-700 border-orange-300"
                                >
                                  ยังไม่ชำระเงิน
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {receipt?.unpaidConfirmedAt ? (
                                <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  ยืนยันแล้ว
                                  {receipt.unpaidConfirmedBy &&
                                    ` (${receipt.unpaidConfirmedBy.name})`}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-gray-500 border-gray-300"
                                >
                                  ยังไม่ยืนยัน
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
