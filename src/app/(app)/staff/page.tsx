"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";

type Staff = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

const roleLabels: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  DATA_ENTRY: "พนักงานนำเข้าข้อมูล",
  WELFARE_STAFF: "พนักงานร้านสวัสดิการ",
};

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  DATA_ENTRY: "bg-blue-100 text-blue-700",
  WELFARE_STAFF: "bg-green-100 text-green-700",
};

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
  });

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    const res = await fetch("/api/staff");
    if (res.ok) setStaff(await res.json());
  }

  async function handleAdd() {
    if (!form.name || !form.email || !form.password || !form.role) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      return;
    }

    toast.success("เพิ่มพนักงานสำเร็จ");
    setForm({ name: "", email: "", password: "", role: "" });
    setOpen(false);
    loadStaff();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`ต้องการลบ "${name}" หรือไม่?`)) return;

    const res = await fetch("/api/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      toast.success("ลบสำเร็จ");
      loadStaff();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">จัดการพนักงาน</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              เพิ่มพนักงาน
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มพนักงานใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>ชื่อ-นามสกุล</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="ชื่อพนักงาน"
                />
              </div>
              <div className="space-y-2">
                <Label>อีเมล</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>รหัสผ่าน</Label>
                <PasswordInput
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="รหัสผ่าน"
                />
              </div>
              <div className="space-y-2">
                <Label>บทบาท</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกบทบาท" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">ผู้ดูแลระบบ</SelectItem>
                    <SelectItem value="DATA_ENTRY">
                      พนักงานนำเข้าข้อมูล
                    </SelectItem>
                    <SelectItem value="WELFARE_STAFF">
                      พนักงานร้านสวัสดิการ
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} className="w-full">
                เพิ่มพนักงาน
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            พนักงานทั้งหมด ({staff.length} คน)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>
                    <Badge className={roleColors[s.role]}>
                      {roleLabels[s.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(s.createdAt).toLocaleDateString("th-TH")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(s.id, s.name)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
