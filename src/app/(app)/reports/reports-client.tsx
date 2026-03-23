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
import { AlertTriangle, Package, BarChart3, Shirt } from "lucide-react";

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

  useEffect(() => {
    if (loaded[activeTab]) return;

    if (activeTab === "summary") loadSummary();
    else if (activeTab === "by-level") loadByLevel();
    else if (activeTab === "size-summary") loadSizeSummary();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">รายงาน</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="not-received" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            ไม่ได้รับสินค้า
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
      </Tabs>
    </div>
  );
}
