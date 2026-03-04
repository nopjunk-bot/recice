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
import { AlertTriangle, Package, BarChart3 } from "lucide-react";

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

export default function ReportsPage() {
  const [notReceived, setNotReceived] = useState<NotReceivedItem[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [byLevel, setByLevel] = useState<LevelData[]>([]);
  const [activeTab, setActiveTab] = useState("not-received");

  useEffect(() => {
    if (activeTab === "not-received") loadNotReceived();
    else if (activeTab === "summary") loadSummary();
    else if (activeTab === "by-level") loadByLevel();
  }, [activeTab]);

  async function loadNotReceived() {
    const res = await fetch("/api/reports?type=not-received");
    setNotReceived(await res.json());
  }

  async function loadSummary() {
    const res = await fetch("/api/reports?type=summary");
    setSummary(await res.json());
  }

  async function loadByLevel() {
    const res = await fetch("/api/reports?type=by-level");
    setByLevel(await res.json());
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
      </Tabs>
    </div>
  );
}
