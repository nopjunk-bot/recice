"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Search, AlertTriangle, CheckSquare, XSquare } from "lucide-react";
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

export default function ManageStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  const loadStudents = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterType) params.set("receiptType", filterType);
    const res = await fetch(`/api/students?${params}`);
    const data = await res.json();
    setStudents(data.students);
    setTotalCount(data.totalCount);
  }, [search, filterType]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  }

  async function handleDeleteSelected() {
    setDeleting(true);
    try {
      const res = await fetch("/api/students/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "selected",
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
      setShowDeleteSelectedDialog(false);
      loadStudents();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteAll() {
    setDeleting(true);
    try {
      const res = await fetch("/api/students/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error);
        return;
      }

      toast.success(data.message);
      setShowDeleteAllDialog(false);
      setConfirmText("");
      setSelectedIds(new Set());
      loadStudents();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setDeleting(false);
    }
  }

  const isAllSelected = students.length > 0 && selectedIds.size === students.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จัดการข้อมูลนักเรียน</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ลบข้อมูลนักเรียนแบบถาวร (รวมใบเสร็จและข้อมูลสวัสดิการที่เกี่ยวข้อง)
          </p>
        </div>
      </div>

      {/* การดำเนินการ */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* ลบที่เลือก */}
        <Button
          variant="destructive"
          disabled={selectedIds.size === 0}
          onClick={() => setShowDeleteSelectedDialog(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          ลบที่เลือก ({selectedIds.size} คน)
        </Button>

        {/* ลบทั้งหมด */}
        <Button
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => setShowDeleteAllDialog(true)}
          disabled={totalCount === 0}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          ลบข้อมูลทั้งหมด ({totalCount} คน)
        </Button>
      </div>

      {/* รายชื่อนักเรียน */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            เลือกนักเรียนที่ต้องการลบ
          </CardTitle>
          <CardDescription>
            เลือกนักเรียนรายบุคคล หรือใช้ปุ่ม &quot;เลือกทั้งหมด&quot; แล้วกดลบ
          </CardDescription>
          <div className="flex flex-col md:flex-row gap-3 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ หรือ เลขประจำตัว..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="ทุกประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                <SelectItem value="M1">ม.1</SelectItem>
                <SelectItem value="M4_GENERAL">ม.4 ทั่วไป</SelectItem>
                <SelectItem value="M4_LANG">ม.4 อังกฤษ จีน ญี่ปุ่น</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={selectAll}
                      aria-label="เลือกทั้งหมด"
                    />
                  </div>
                </TableHead>
                <TableHead>เลขประจำตัว</TableHead>
                <TableHead>ชื่อ-นามสกุล</TableHead>
                <TableHead>ชั้น/ห้อง</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>ใบเสร็จ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow
                  key={s.id}
                  className={selectedIds.has(s.id) ? "bg-red-50" : ""}
                >
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectedIds.has(s.id)}
                        onCheckedChange={() => toggleSelect(s.id)}
                        aria-label={`เลือก ${s.firstName} ${s.lastName}`}
                      />
                    </div>
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

          {/* ปุ่มเลือก/ยกเลิกด้านล่างตาราง */}
          {students.length > 0 && (
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
              >
                {isAllSelected ? (
                  <>
                    <XSquare className="w-4 h-4 mr-1" />
                    ยกเลิกทั้งหมด
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4 mr-1" />
                    เลือกทั้งหมด
                  </>
                )}
              </Button>
              {selectedIds.size > 0 && (
                <span className="text-sm text-muted-foreground self-center">
                  เลือกแล้ว {selectedIds.size} จาก {students.length} คน
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog ยืนยันลบที่เลือก */}
      <Dialog open={showDeleteSelectedDialog} onOpenChange={setShowDeleteSelectedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              ยืนยันการลบนักเรียนที่เลือก
            </DialogTitle>
            <DialogDescription>
              คุณกำลังจะลบข้อมูลนักเรียน <strong>{selectedIds.size} คน</strong> อย่างถาวร
              ข้อมูลที่เกี่ยวข้องทั้งหมด (ใบเสร็จ, ข้อมูลสวัสดิการ) จะถูกลบไปด้วย
              <br />
              <span className="text-red-600 font-medium">การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteSelectedDialog(false)}
              disabled={deleting}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleting ? "กำลังลบ..." : `ลบ ${selectedIds.size} คน`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ยืนยันลบทั้งหมด - ต้องพิมพ์ยืนยัน */}
      <Dialog open={showDeleteAllDialog} onOpenChange={(open) => {
        setShowDeleteAllDialog(open);
        if (!open) setConfirmText("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              ลบข้อมูลนักเรียนทั้งหมด
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p>
                  คุณกำลังจะลบข้อมูลนักเรียน <strong>ทั้งหมด {totalCount} คน</strong> ออกจากระบบอย่างถาวร
                </p>
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3 space-y-1">
                  <p className="font-medium text-red-700">ข้อมูลที่จะถูกลบ:</p>
                  <ul className="text-sm text-red-600 list-disc list-inside">
                    <li>ข้อมูลนักเรียนทั้งหมด</li>
                    <li>ใบเสร็จที่พิมพ์แล้วทั้งหมด</li>
                    <li>ข้อมูลการรับสวัสดิการทั้งหมด</li>
                    <li>ประวัติการนำเข้าข้อมูลทั้งหมด</li>
                  </ul>
                </div>
                <p className="mt-3 text-sm">
                  พิมพ์ <strong className="text-red-600">ลบทั้งหมด</strong> เพื่อยืนยัน:
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="พิมพ์ 'ลบทั้งหมด' เพื่อยืนยัน"
            className="border-red-300 focus-visible:ring-red-500"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteAllDialog(false);
                setConfirmText("");
              }}
              disabled={deleting}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={deleting || confirmText !== "ลบทั้งหมด"}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleting ? "กำลังลบทั้งหมด..." : "ลบข้อมูลทั้งหมด"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
