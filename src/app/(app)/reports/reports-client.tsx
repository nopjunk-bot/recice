"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { AlertTriangle, Package, BarChart3, Shirt, CheckCircle, Search, ChevronLeft, ChevronRight, FileDown, Banknote, CircleDollarSign, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateUnpaidReportPDF, generateUnderpaidReportPDF } from "@/lib/pdf-generator";

type NotReceivedItem = {
  id: string;
  received: boolean;
  notReceivedReason: string | null;
  scannedAt: string;
  student: {
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    level: string;
    room: string;
  };
  item: {
    name: string;
  };
};

type SummaryItem = {
  item: string;
  received: number;
  notReceived: number;
  notScanned: number;
  total: number;
};

type LevelData = {
  level: string;
  total: number;
  scanned: number;
  pending: number;
};

type SizeStudent = {
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
};

type SizeSummary = Record<string, Record<string, { count: number; students: SizeStudent[] }>>;

type ReceivedStudent = {
  id: string;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
};

type ReceivedResponse = {
  data: ReceivedStudent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type StudentInfo = {
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
};

type UnpaidItem = {
  id: string;
  receiptNumber: string;
  receiptType: string;
  expectedAmount: number;
  student: StudentInfo;
};

type UnderpaidItem = {
  id: string;
  receiptNumber: string;
  receiptType: string;
  paidAmount: number;
  expectedAmount: number;
  difference: number;
  student: StudentInfo;
};

const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_ENGLISH: "ม.4 อังกฤษ",
  M4_CHINESE: "ม.4 จีน",
  M4_JAPANESE: "ม.4 ญี่ปุ่น",
};

// ดึงระดับชั้น (ม.1, ม.4) จาก level เช่น "1" → "ม.1", "4" → "ม.4"
function getGradeLevel(level: string): string {
  const trimmed = level.trim();
  // รองรับทั้งรูปแบบ "1", "ม.1", "1/1"
  const match = trimmed.match(/(\d+)/);
  if (match) return `ม.${match[1]}`;
  return trimmed || "ไม่ระบุ";
}

export default function ReportsClient({
  initialNotReceived,
}: {
  initialNotReceived: NotReceivedItem[];
}) {
  const [notReceived] = useState<NotReceivedItem[]>(initialNotReceived);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [byLevel, setByLevel] = useState<LevelData[]>([]);
  const [sizeSummary, setSizeSummary] = useState<SizeSummary>({});
  const [activeTab, setActiveTab] = useState("not-received");
  const [loaded, setLoaded] = useState<Record<string, boolean>>({
    "not-received": true, // แท็บแรกโหลดมาจาก server แล้ว
  });

  // State สำหรับ tabs ค้างชำระ
  const [unpaid, setUnpaid] = useState<UnpaidItem[]>([]);
  const [underpaid, setUnderpaid] = useState<UnderpaidItem[]>([]);

  // State สำหรับ tab ยังไม่สแกน
  const [notScanned, setNotScanned] = useState<ReceivedStudent[]>([]);

  // State สำหรับ tab "รับสินค้าแล้ว"
  const [received, setReceived] = useState<ReceivedStudent[]>([]);
  const [receivedPagination, setReceivedPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [receivedSearch, setReceivedSearch] = useState("");
  const [receivedLevel, setReceivedLevel] = useState("");
  const [receivedLoading, setReceivedLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "received") {
      loadReceived(1);
      return;
    }

    if (loaded[activeTab]) return;

    if (activeTab === "summary") loadSummary();
    else if (activeTab === "by-level") loadByLevel();
    else if (activeTab === "size-summary") loadSizeSummary();
    else if (activeTab === "not-scanned") loadNotScanned();
    else if (activeTab === "unpaid") loadUnpaid();
    else if (activeTab === "underpaid") loadUnderpaid();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadReceived(page: number, search?: string, level?: string) {
    setReceivedLoading(true);
    const s = search ?? receivedSearch;
    const l = level ?? receivedLevel;
    const params = new URLSearchParams({ type: "received", page: String(page) });
    if (s) params.set("search", s);
    if (l) params.set("level", l);

    const res = await fetch(`/api/reports?${params}`);
    const json: ReceivedResponse = await res.json();
    setReceived(json.data);
    setReceivedPagination({ page: json.pagination.page, total: json.pagination.total, totalPages: json.pagination.totalPages });
    setReceivedLoading(false);
  }

  async function loadSummary() {
    const res = await fetch("/api/reports?type=summary");
    setSummary(await res.json());
    setLoaded((prev) => ({ ...prev, "summary": true }));
  }

  async function loadByLevel() {
    const res = await fetch("/api/reports?type=by-level");
    setByLevel(await res.json());
    setLoaded((prev) => ({ ...prev, "by-level": true }));
  }

  async function loadSizeSummary() {
    const res = await fetch("/api/reports?type=size-summary");
    setSizeSummary(await res.json());
    setLoaded((prev) => ({ ...prev, "size-summary": true }));
  }

  async function loadNotScanned() {
    const res = await fetch("/api/reports?type=not-scanned");
    if (res.ok) setNotScanned(await res.json());
    setLoaded((prev) => ({ ...prev, "not-scanned": true }));
  }

  async function loadUnpaid() {
    const res = await fetch("/api/receipts/unpaid");
    if (res.ok) setUnpaid(await res.json());
    setLoaded((prev) => ({ ...prev, "unpaid": true }));
  }

  async function loadUnderpaid() {
    const res = await fetch("/api/receipts/underpaid");
    if (res.ok) setUnderpaid(await res.json());
    setLoaded((prev) => ({ ...prev, "underpaid": true }));
  }

  // จัดกลุ่มนักเรียนตามระดับชั้น (ม.1, ม.4)
  function groupByGrade<T extends { student: StudentInfo }>(items: T[]): Record<string, T[]> {
    return items.reduce((acc, item) => {
      const grade = getGradeLevel(item.student.level);
      if (!acc[grade]) acc[grade] = [];
      acc[grade].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">รายงาน</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="not-received" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            ไม่ได้รับสินค้า
          </TabsTrigger>
          <TabsTrigger value="received" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            รับสินค้าแล้ว
          </TabsTrigger>
          <TabsTrigger value="not-scanned" className="gap-2">
            <UserX className="w-4 h-4" />
            ยังไม่สแกน
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <Package className="w-4 h-4" />
            สรุปสินค้าที่แจก
          </TabsTrigger>
          <TabsTrigger value="by-level" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            แบ่งตามชั้น
          </TabsTrigger>
          <TabsTrigger value="size-summary" className="gap-2">
            <Shirt className="w-4 h-4" />
            สรุปไซส์ค้างรับ
          </TabsTrigger>
          <TabsTrigger value="unpaid" className="gap-2">
            <Banknote className="w-4 h-4" />
            ค้างชำระเต็มจำนวน
          </TabsTrigger>
          <TabsTrigger value="underpaid" className="gap-2">
            <CircleDollarSign className="w-4 h-4" />
            ชำระไม่ครบ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="not-received">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                นักเรียนที่ไม่ได้รับสินค้า ({notReceived.length} รายการ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขประจำตัว</TableHead>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>ชั้น/ห้อง</TableHead>
                    <TableHead>สินค้าที่ไม่ได้รับ</TableHead>
                    <TableHead>วันที่บันทึก</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notReceived.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">
                        {item.student.studentCode}
                      </TableCell>
                      <TableCell>
                        {item.student.prefix}
                        {item.student.firstName} {item.student.lastName}
                      </TableCell>
                      <TableCell>
                        {item.student.level}/{item.student.room}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{item.item.name}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(item.scannedAt).toLocaleDateString("th-TH")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {notReceived.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        ไม่มีนักเรียนที่ไม่ได้รับสินค้า
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="received">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                รายชื่อนักเรียนที่รับสินค้าแล้ว ({receivedPagination.total} คน)
              </CardTitle>
              {/* ช่องค้นหา + ตัวกรอง */}
              <div className="flex flex-col sm:flex-row gap-3 mt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อ หรือ เลขประจำตัว..."
                    className="pl-9"
                    value={receivedSearch}
                    onChange={(e) => {
                      setReceivedSearch(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") loadReceived(1, receivedSearch, receivedLevel);
                    }}
                  />
                </div>
                <select
                  className="border rounded-md px-3 py-2 text-sm bg-white"
                  value={receivedLevel}
                  onChange={(e) => {
                    setReceivedLevel(e.target.value);
                    loadReceived(1, receivedSearch, e.target.value);
                  }}
                >
                  <option value="">ทุกชั้น</option>
                  <option value="ม.1">ม.1</option>
                  <option value="ม.4">ม.4</option>
                </select>
                <button
                  className="px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50"
                  onClick={() => loadReceived(1, receivedSearch, receivedLevel)}
                  disabled={receivedLoading}
                >
                  ค้นหา
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {receivedLoading ? (
                <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>เลขประจำตัว</TableHead>
                        <TableHead>ชื่อ-นามสกุล</TableHead>
                        <TableHead>ชั้น/ห้อง</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {received.map((student, idx) => (
                        <TableRow key={student.id}>
                          <TableCell className="text-muted-foreground">
                            {(receivedPagination.page - 1) * 50 + idx + 1}
                          </TableCell>
                          <TableCell className="font-mono">
                            {student.studentCode}
                          </TableCell>
                          <TableCell>
                            {student.prefix}{student.firstName} {student.lastName}
                          </TableCell>
                          <TableCell>
                            {student.level}/{student.room}
                          </TableCell>
                        </TableRow>
                      ))}
                      {received.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            ไม่พบข้อมูล
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {receivedPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        หน้า {receivedPagination.page} / {receivedPagination.totalPages} (ทั้งหมด {receivedPagination.total} คน)
                      </p>
                      <div className="flex gap-2">
                        <button
                          className="p-2 border rounded-md hover:bg-gray-100 disabled:opacity-30"
                          disabled={receivedPagination.page <= 1}
                          onClick={() => loadReceived(receivedPagination.page - 1)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 border rounded-md hover:bg-gray-100 disabled:opacity-30"
                          disabled={receivedPagination.page >= receivedPagination.totalPages}
                          onClick={() => loadReceived(receivedPagination.page + 1)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="not-scanned">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-lg">
                  นักเรียนที่ยังไม่ได้สแกนรับสินค้า ({notScanned.length} คน)
                </CardTitle>
                <Button
                  variant="outline"
                  disabled={notScanned.length === 0}
                  onClick={() => {
                    window.open("/api/reports/not-scanned/download", "_blank");
                  }}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  ดาวน์โหลด Excel (แยกตามชั้น)
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {notScanned.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  ไม่มีนักเรียนที่ยังไม่ได้สแกน
                </p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(
                    notScanned.reduce((acc, s) => {
                      const grade = getGradeLevel(s.level);
                      if (!acc[grade]) acc[grade] = [];
                      acc[grade].push(s);
                      return acc;
                    }, {} as Record<string, ReceivedStudent[]>)
                  )
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([grade, list]) => (
                      <div key={grade}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-lg text-amber-700">
                            {grade} — {list.length} คน
                          </h3>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>เลขประจำตัว</TableHead>
                              <TableHead>ชื่อ-นามสกุล</TableHead>
                              <TableHead>ชั้น/ห้อง</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {list.map((s, i) => (
                              <TableRow key={s.id}>
                                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                <TableCell className="font-mono">{s.studentCode}</TableCell>
                                <TableCell>
                                  {s.prefix}{s.firstName} {s.lastName}
                                </TableCell>
                                <TableCell>{s.level}/{s.room}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                สรุปสินค้าที่แจกไปแล้ว
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {summary.map((s) => (
                  <Card key={s.item}>
                    <CardContent className="pt-6">
                      <h3 className="font-bold text-lg mb-3">{s.item}</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            ได้รับแล้ว
                          </span>
                          <Badge className="bg-green-100 text-green-700">
                            {s.received} คน
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            ไม่ได้รับ
                          </span>
                          <Badge variant="destructive">{s.notReceived} คน</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            ยังไม่สแกน
                          </span>
                          <Badge variant="secondary">{s.notScanned} คน</Badge>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                          <div
                            className="bg-green-500 h-3 rounded-full transition-all"
                            style={{
                              width: `${
                                s.total > 0
                                  ? ((s.received / s.total) * 100).toFixed(1)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-right text-muted-foreground">
                          {s.total > 0
                            ? ((s.received / s.total) * 100).toFixed(1)
                            : 0}
                          %
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-level">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                สรุปแบ่งตามชั้นเรียน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชั้น</TableHead>
                    <TableHead>นักเรียนทั้งหมด</TableHead>
                    <TableHead>สแกนแล้ว</TableHead>
                    <TableHead>ยังไม่สแกน</TableHead>
                    <TableHead>ความคืบหน้า</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byLevel.map((row) => (
                    <TableRow key={row.level}>
                      <TableCell className="font-bold">{row.level}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700">
                          {row.scanned}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.pending}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  row.total > 0
                                    ? (row.scanned / row.total) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {row.total > 0
                              ? ((row.scanned / row.total) * 100).toFixed(0)
                              : 0}
                            %
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="size-summary">
          <div className="space-y-6">
            {Object.keys(sizeSummary).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  ยังไม่มีข้อมูลไซส์ที่ค้างรับ
                </CardContent>
              </Card>
            ) : (
              Object.entries(sizeSummary).map(([itemName, sizes]) => {
                const totalCount = Object.values(sizes).reduce((sum, s) => sum + s.count, 0);
                return (
                  <Card key={itemName}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Shirt className="w-5 h-5" />
                        {itemName} - ค้างรับทั้งหมด {totalCount} คน
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Size summary cards */}
                      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3 mb-6">
                        {Object.entries(sizes)
                          .sort(([a], [b]) => {
                            const order = ["SS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
                            return order.indexOf(a) - order.indexOf(b);
                          })
                          .map(([size, data]) => (
                            <div
                              key={size}
                              className="text-center p-3 rounded-lg border-2 border-orange-200 bg-orange-50"
                            >
                              <p className="text-2xl font-bold text-orange-700">{data.count}</p>
                              <p className="text-sm font-medium text-orange-600">{size}</p>
                            </div>
                          ))}
                      </div>

                      {/* Student list per size */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ไซส์</TableHead>
                            <TableHead>เลขประจำตัว</TableHead>
                            <TableHead>ชื่อ-นามสกุล</TableHead>
                            <TableHead>ชั้น/ห้อง</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(sizes)
                            .sort(([a], [b]) => {
                              const order = ["SS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
                              return order.indexOf(a) - order.indexOf(b);
                            })
                            .flatMap(([size, data]) =>
                              data.students.map((st, i) => (
                                <TableRow key={`${size}-${st.studentCode}`}>
                                  {i === 0 ? (
                                    <TableCell
                                      rowSpan={data.students.length}
                                      className="font-bold text-center align-top"
                                    >
                                      <Badge className="bg-orange-100 text-orange-700 text-base">
                                        {size}
                                      </Badge>
                                    </TableCell>
                                  ) : null}
                                  <TableCell className="font-mono">{st.studentCode}</TableCell>
                                  <TableCell>
                                    {st.prefix}{st.firstName} {st.lastName}
                                  </TableCell>
                                  <TableCell>{st.level}/{st.room}</TableCell>
                                </TableRow>
                              ))
                            )}
                          {Object.keys(sizes).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                ไม่มีข้อมูล
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Tab: ค้างชำระเต็มจำนวน */}
        <TabsContent value="unpaid">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-lg">
                    นักเรียนค้างชำระเต็มจำนวน ({unpaid.length} คน)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    ยอดค้างชำระรวม: {unpaid.reduce((s, r) => s + r.expectedAmount, 0).toLocaleString()} บาท
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={unpaid.length === 0}
                  onClick={() => generateUnpaidReportPDF(unpaid)}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  ดาวน์โหลด PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {unpaid.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  ไม่มีนักเรียนค้างชำระ
                </p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupByGrade(unpaid))
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([grade, items]) => {
                      const totalAmt = items.reduce((s, r) => s + r.expectedAmount, 0);
                      return (
                        <div key={grade}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-lg text-red-700">
                              {grade} — {items.length} คน
                            </h3>
                            <Badge variant="destructive">
                              {totalAmt.toLocaleString()} บาท
                            </Badge>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>เลขประจำตัว</TableHead>
                                <TableHead>ชื่อ-นามสกุล</TableHead>
                                <TableHead>ชั้น/ห้อง</TableHead>
                                <TableHead>ประเภท</TableHead>
                                <TableHead className="text-right">ยอดค้างชำระ</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((r) => (
                                <TableRow key={r.id}>
                                  <TableCell className="font-mono">{r.student.studentCode}</TableCell>
                                  <TableCell>
                                    {r.student.prefix}{r.student.firstName} {r.student.lastName}
                                  </TableCell>
                                  <TableCell>{r.student.level}/{r.student.room}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">
                                      {receiptTypeLabels[r.receiptType] || r.receiptType}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-red-600">
                                    {r.expectedAmount.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: ชำระไม่ครบ */}
        <TabsContent value="underpaid">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-lg">
                    นักเรียนชำระเงินไม่ครบ ({underpaid.length} คน)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    ส่วนต่างรวม: {underpaid.reduce((s, r) => s + r.difference, 0).toLocaleString()} บาท
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={underpaid.length === 0}
                  onClick={() => generateUnderpaidReportPDF(underpaid)}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  ดาวน์โหลด PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {underpaid.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  ไม่มีนักเรียนชำระเงินไม่ครบ
                </p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupByGrade(underpaid))
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([grade, items]) => {
                      const totalDiff = items.reduce((s, r) => s + r.difference, 0);
                      return (
                        <div key={grade}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-lg text-orange-700">
                              {grade} — {items.length} คน
                            </h3>
                            <Badge className="bg-orange-100 text-orange-700">
                              ส่วนต่าง {totalDiff.toLocaleString()} บาท
                            </Badge>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>เลขประจำตัว</TableHead>
                                <TableHead>ชื่อ-นามสกุล</TableHead>
                                <TableHead>ชั้น/ห้อง</TableHead>
                                <TableHead>ประเภท</TableHead>
                                <TableHead className="text-right">ยอดชำระ</TableHead>
                                <TableHead className="text-right">ยอดเต็ม</TableHead>
                                <TableHead className="text-right">ส่วนต่าง</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((r) => (
                                <TableRow key={r.id}>
                                  <TableCell className="font-mono">{r.student.studentCode}</TableCell>
                                  <TableCell>
                                    {r.student.prefix}{r.student.firstName} {r.student.lastName}
                                  </TableCell>
                                  <TableCell>{r.student.level}/{r.student.room}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">
                                      {receiptTypeLabels[r.receiptType] || r.receiptType}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {r.paidAmount.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {r.expectedAmount.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-orange-600">
                                    {r.difference.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
