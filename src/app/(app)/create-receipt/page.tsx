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
import { FilePlus2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateReceiptPDF } from "@/lib/pdf-generator";

const initialForm = {
  studentCode: "",
  prefix: "",
  firstName: "",
  lastName: "",
  level: "",
  room: "",
  receiptType: "",
  amount: "",
};

export default function CreateReceiptPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [looking, setLooking] = useState(false);
  const [foundStudent, setFoundStudent] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleLookup() {
    const code = form.studentCode.trim();
    if (!code) return;

    setLooking(true);
    try {
      const res = await fetch(`/api/students/lookup?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        const s = data.student;
        setForm((prev) => ({
          ...prev,
          prefix: s.prefix,
          firstName: s.firstName,
          lastName: s.lastName,
          level: s.level,
          room: s.room,
          receiptType: s.receiptType,
        }));
        setFoundStudent(true);
        toast.success(`พบข้อมูล: ${s.prefix}${s.firstName} ${s.lastName}`);
      } else {
        setFoundStudent(false);
      }
    } catch {
      // ignore - student not found
    } finally {
      setLooking(false);
    }
  }

  async function handleSubmit() {
    // Validate
    if (!form.studentCode || !form.prefix || !form.firstName || !form.lastName || !form.level || !form.room || !form.receiptType) {
      toast.error("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error("กรุณากรอกจำนวนเงินที่ถูกต้อง");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/receipts/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentCode: form.studentCode.trim(),
          prefix: form.prefix,
          firstName: form.firstName,
          lastName: form.lastName,
          level: form.level,
          room: form.room,
          receiptType: form.receiptType,
          amount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      // Generate and download PDF
      const today = new Date().toISOString().split("T")[0];
      generateReceiptPDF([data.receipt], today);

      toast.success(`สร้างใบเสร็จสำเร็จ: ${data.receipt.receiptNumber}`);

      // Reset form
      setForm(initialForm);
      setFoundStudent(false);
    } catch {
      toast.error("เกิดข้อผิดพลาดในการสร้างใบเสร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">สร้างใบเสร็จชั่วคราว</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">กรอกข้อมูลนักเรียน</CardTitle>
          <p className="text-sm text-muted-foreground">
            กรอกข้อมูลนักเรียนและจำนวนเงินเพื่อสร้างใบเสร็จชั่วคราว
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Student Code with Lookup */}
          <div className="space-y-2">
            <Label>เลขประจำตัวนักเรียน</Label>
            <div className="flex gap-2">
              <Input
                placeholder="เช่น 12345"
                value={form.studentCode}
                onChange={(e) => {
                  updateField("studentCode", e.target.value);
                  setFoundStudent(false);
                }}
                onBlur={handleLookup}
              />
              <Button
                variant="outline"
                onClick={handleLookup}
                disabled={looking || !form.studentCode.trim()}
              >
                {looking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
            {foundStudent && (
              <p className="text-xs text-green-600">
                พบข้อมูลนักเรียนในระบบ - ดึงข้อมูลมาเติมให้แล้ว (แก้ไขได้)
              </p>
            )}
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>คำนำหน้า</Label>
              <Select value={form.prefix} onValueChange={(v) => updateField("prefix", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกคำนำหน้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="เด็กชาย">เด็กชาย</SelectItem>
                  <SelectItem value="เด็กหญิง">เด็กหญิง</SelectItem>
                  <SelectItem value="นาย">นาย</SelectItem>
                  <SelectItem value="นางสาว">นางสาว</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ชื่อ</Label>
              <Input
                placeholder="ชื่อ"
                value={form.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>นามสกุล</Label>
              <Input
                placeholder="นามสกุล"
                value={form.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
              />
            </div>
          </div>

          {/* Level, Room, Receipt Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>ชั้น</Label>
              <Input
                placeholder="เช่น ม.1"
                value={form.level}
                onChange={(e) => updateField("level", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ห้อง</Label>
              <Input
                placeholder="เช่น 1"
                value={form.room}
                onChange={(e) => updateField("room", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ประเภทใบเสร็จ</Label>
              <Select value={form.receiptType} onValueChange={(v) => updateField("receiptType", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M1">ม.1</SelectItem>
                  <SelectItem value="M4_GENERAL">ม.4 ทั่วไป</SelectItem>
                  <SelectItem value="M4_LANG">ม.4 อังกฤษ จีน ญี่ปุ่น</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>จำนวนเงิน (บาท)</Label>
            <Input
              type="number"
              placeholder="เช่น 4250"
              min="1"
              value={form.amount}
              onChange={(e) => updateField("amount", e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full md:w-auto"
            size="lg"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FilePlus2 className="w-4 h-4 mr-2" />
            )}
            {loading ? "กำลังสร้างใบเสร็จ..." : "สร้างใบเสร็จและดาวน์โหลด PDF"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
