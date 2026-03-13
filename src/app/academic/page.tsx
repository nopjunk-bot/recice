"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  Search,
  LogOut,
  Users,
  Banknote,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { toast, Toaster } from "sonner";

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
    receiptNumber: string;
    totalAmount: number;
    unpaidConfirmedAt: string;
  }[];
};

type RoomInfo = {
  level: string;
  room: string;
};

const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_LANG: "ม.4 ภาษา",
};

export default function AcademicPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [students, setStudents] = useState<UnpaidStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);

  // Login handler
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/academic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setLoginError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }

      setIsLoggedIn(true);
      setUsername("");
      setPassword("");
    } catch {
      setLoginError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoginLoading(false);
    }
  }

  // Logout handler
  async function handleLogout() {
    await fetch("/api/academic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setIsLoggedIn(false);
    setStudents([]);
  }

  // Load unpaid students
  const loadStudents = useCallback(async () => {
    const levelFilter = selectedLevel === "all" ? "" : selectedLevel;
    const roomFilter = selectedRoom === "all" ? "" : selectedRoom;
    setLoading(true);
    try {
      const res = await fetch("/api/academic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unpaid-list",
          search: search || undefined,
          level: levelFilter || undefined,
          room: roomFilter || undefined,
        }),
      });

      if (res.status === 401) {
        setIsLoggedIn(false);
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setStudents(data.students);
        setTotalUnpaid(data.totalUnpaid);
        setTotalAmount(data.totalAmount);
        setRooms(data.rooms);
      }
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [search, selectedLevel, selectedRoom]);

  // Load on login and filter changes
  useEffect(() => {
    if (!isLoggedIn) return;
    const timer = setTimeout(() => {
      loadStudents();
    }, 400);
    return () => clearTimeout(timer);
  }, [isLoggedIn, loadStudents]);

  // Get unique levels from rooms
  const levels = [...new Set(rooms.map((r) => r.level))].sort();
  const effectiveLevel = selectedLevel === "all" ? "" : selectedLevel;
  const effectiveRoom = selectedRoom === "all" ? "" : selectedRoom;
  const filteredRooms = effectiveLevel
    ? rooms.filter((r) => r.level === effectiveLevel)
    : rooms;

  // Reset room when level changes
  useEffect(() => {
    setSelectedRoom("");
  }, [selectedLevel]);

  // ─── LOGIN SCREEN ───
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Toaster richColors position="top-center" />
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <GraduationCap className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">ฝ่ายวิชาการ</CardTitle>
            <CardDescription>
              เข้าสู่ระบบเพื่อดูข้อมูลนักเรียนที่ค้างชำระเงินค่าเทอม
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">ชื่อผู้ใช้</Label>
                <Input
                  id="username"
                  placeholder="ชื่อผู้ใช้"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="รหัสผ่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {loginError && (
                <p className="text-sm text-red-500 text-center">{loginError}</p>
              )}
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={loginLoading}
              >
                <Lock className="w-4 h-4 mr-2" />
                {loginLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── MAIN CONTENT ───
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                ข้อมูลนักเรียนค้างชำระเงินค่าเทอม
              </h1>
              <p className="text-sm text-muted-foreground">
                ฝ่ายวิชาการ — ข้อมูลแจ้งนักเรียนที่ยังค้างชำระ
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            ออกจากระบบ
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-red-600">
                    {totalUnpaid}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    นักเรียนค้างชำระทั้งหมด
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Banknote className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-orange-600">
                    {totalAmount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ยอดค้างชำระรวม (บาท)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              รายชื่อนักเรียนที่ค้างชำระเงิน
            </CardTitle>
            <CardDescription>
              นักเรียนที่ได้รับการยืนยันแล้วว่ายังไม่ได้ชำระเงินค่าเทอม
            </CardDescription>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ หรือ เลขประจำตัว..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="ชั้นเรียน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกชั้น</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="ห้อง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกห้อง</SelectItem>
                  {filteredRooms.map((r) => (
                    <SelectItem key={`${r.level}-${r.room}`} value={r.room}>
                      {r.level}/{r.room}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                กำลังโหลดข้อมูล...
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">
                  {search || selectedLevel || selectedRoom
                    ? "ไม่พบนักเรียนที่ตรงกับเงื่อนไข"
                    : "ไม่มีนักเรียนค้างชำระเงิน"}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>เลขประจำตัว</TableHead>
                        <TableHead>ชื่อ-นามสกุล</TableHead>
                        <TableHead>ชั้น/ห้อง</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead className="text-right">
                          จำนวนเงิน (บาท)
                        </TableHead>
                        <TableHead>เลขที่ใบเสร็จ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((s, i) => {
                        const receipt = s.receipts[0];
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="text-muted-foreground">
                              {i + 1}
                            </TableCell>
                            <TableCell className="font-mono font-bold">
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
                                {receiptTypeLabels[s.receiptType] ||
                                  s.receiptType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-red-600">
                              {receipt?.totalAmount?.toLocaleString() || "-"}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {receipt?.receiptNumber || "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                  <span>แสดง {students.length} คน</span>
                  <span className="font-semibold text-red-600">
                    ยอดค้างชำระรวม:{" "}
                    {students
                      .reduce(
                        (sum, s) => sum + (s.receipts[0]?.totalAmount || 0),
                        0
                      )
                      .toLocaleString()}{" "}
                    บาท
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
