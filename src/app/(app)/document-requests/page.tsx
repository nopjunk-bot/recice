"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  FileSearch,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast, Toaster } from "sonner";

type DocumentRequest = {
  id: string;
  studentName: string;
  requestRound: number;
  status: "PENDING" | "COMPLETED" | "REJECTED";
  pickupDate: string | null;
  note: string | null;
  createdAt: string;
  student: {
    studentCode: string;
    prefix: string;
    firstName: string;
    lastName: string;
    level: string;
    room: string;
  };
  receipt: {
    receiptNumber: string;
    totalAmount: number;
    receiptType: string;
  };
};

type StatusCounts = {
  PENDING: number;
  COMPLETED: number;
  REJECTED: number;
};

const statusLabels: Record<string, string> = {
  PENDING: "รอดำเนินการ",
  COMPLETED: "ดำเนินการแล้ว",
  REJECTED: "ปฏิเสธ",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_LANG: "ม.4 ภาษา",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export default function DocumentRequestsPage() {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    PENDING: 0,
    COMPLETED: 0,
    REJECTED: 0,
  });
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRound, setFilterRound] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterRound !== "all") params.set("round", filterRound);
      if (search) params.set("search", search);
      params.set("page", page.toString());

      const res = await fetch(`/api/document-request?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setRequests(data.requests);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setStatusCounts(data.statusCounts);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterRound, search, page]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleSearchChange = (value: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 500);
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/document-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast.success(`อัปเดตสถานะเป็น "${statusLabels[newStatus]}" แล้ว`);
      loadRequests();
    } catch {
      toast.error("ไม่สามารถอัปเดตสถานะได้");
    }
  };

  const totalAll = statusCounts.PENDING + statusCounts.COMPLETED + statusCounts.REJECTED;

  return (
    <div className="space-y-6">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <FileSearch className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">คำขอเอกสาร</h1>
          <p className="text-gray-500">จัดการคำขอเอกสารใบสำคัญเบิกเงินสวัสดิการ</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalAll}</div>
            <p className="text-sm text-gray-500">ทั้งหมด</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{statusCounts.PENDING}</div>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> รอดำเนินการ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{statusCounts.COMPLETED}</div>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> ดำเนินการแล้ว
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{statusCounts.REJECTED}</div>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> ปฏิเสธ
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ตัวกรอง</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="w-48">
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="PENDING">รอดำเนินการ</SelectItem>
                  <SelectItem value="COMPLETED">ดำเนินการแล้ว</SelectItem>
                  <SelectItem value="REJECTED">ปฏิเสธ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filterRound} onValueChange={(v) => { setFilterRound(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="รอบ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกรอบ</SelectItem>
                  <SelectItem value="1">รอบที่ 1</SelectItem>
                  <SelectItem value="2">รอบที่ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="ค้นหาชื่อนักเรียน, รหัส, เลขใบเสร็จ..."
                  className="pl-9"
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่ขอ</TableHead>
                <TableHead>รหัสนักเรียน</TableHead>
                <TableHead>ชื่อ-สกุล</TableHead>
                <TableHead>ชั้น/ห้อง</TableHead>
                <TableHead>เลขใบเสร็จ</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>รอบ</TableHead>
                <TableHead>วันรับเอกสาร</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                    กำลังโหลด...
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                    ไม่พบข้อมูลคำขอ
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(req.createdAt)}
                    </TableCell>
                    <TableCell>{req.student.studentCode}</TableCell>
                    <TableCell>
                      {req.student.prefix}{req.student.firstName} {req.student.lastName}
                    </TableCell>
                    <TableCell>
                      {req.student.level}/{req.student.room}
                    </TableCell>
                    <TableCell>{req.receipt.receiptNumber}</TableCell>
                    <TableCell>
                      {receiptTypeLabels[req.receipt.receiptType] || req.receipt.receiptType}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">รอบ {req.requestRound}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {req.pickupDate ? formatDate(req.pickupDate) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[req.status]}>
                        {statusLabels[req.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={req.status}
                        onValueChange={(v) => handleStatusUpdate(req.id, v)}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">รอดำเนินการ</SelectItem>
                          <SelectItem value="COMPLETED">ดำเนินการแล้ว</SelectItem>
                          <SelectItem value="REJECTED">ปฏิเสธ</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            แสดง {requests.length} จาก {total} รายการ
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              หน้า {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
