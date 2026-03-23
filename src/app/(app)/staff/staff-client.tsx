"use client";

import { useState } from "react";
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
import { UserPlus, Trash2, Pencil } from "lucide-react";
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
  FINANCE: "ฝ่ายการเงิน",
  WELFARE_STAFF: "พนักงานร้านสวัสดิการ",
  ACADEMIC: "ฝ่ายวิชาการ",
};

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  FINANCE: "bg-blue-100 text-blue-700",
  WELFARE_STAFF: "bg-green-100 text-green-700",
  ACADEMIC: "bg-orange-100 text-orange-700",
};

export default function StaffClient({
  initialStaff,
}: {
  initialStaff: Staff[];
}) {
  const [staff, setStaff] = useState<Staff[]>(initialStaff);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "",
  });

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

  function openEdit(s: Staff) {
    setEditingStaff(s);
    setEditForm({ name: s.name, email: s.email, password: "", role: s.role });
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editingStaff) return;
    if (!editForm.name || !editForm.email || !editForm.role) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    const res = await fetch("/api/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingStaff.id, ...editForm }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      return;
    }

    toast.success("แก้ไขข้อมูลสำเร็จ");
    setEditOpen(false);
    setEditingStaff(null);
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
                    <SelectItem value="FINANCE">ฝ่ายการเงิน</SelectItem>
                    <SelectItem value="WELFARE_STAFF">
                      พนักงานร้านสวัสดิการ
                    </SelectItem>
                    <SelectItem value="ACADEMIC">ฝ่ายวิชาการ</SelectItem>
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
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="w-4 h-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(s.id, s.name)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลพนักงาน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>ชื่อ-นามสกุล</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="ชื่อพนักงาน"
              />
            </div>
            <div className="space-y-2">
              <Label>อีเมล</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>รหัสผ่านใหม่ (เว้นว่างถ้าไม่ต้องการเปลี่ยน)</Label>
              <PasswordInput
                value={editForm.password}
                onChange={(e) =>
                  setEditForm({ ...editForm, password: e.target.value })
                }
                placeholder="รหัสผ่านใหม่"
              />
            </div>
            <div className="space-y-2">
              <Label>บทบาท</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm({ ...editForm, role: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบทบาท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ผู้ดูแลระบบ</SelectItem>
                  <SelectItem value="FINANCE">ฝ่ายการเงิน</SelectItem>
                  <SelectItem value="WELFARE_STAFF">
                    พนักงานร้านสวัสดิการ
                  </SelectItem>
                  <SelectItem value="ACADEMIC">ฝ่ายวิชาการ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleEdit} className="w-full">
              บันทึกการแก้ไข
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
