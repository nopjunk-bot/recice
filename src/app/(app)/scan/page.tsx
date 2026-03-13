"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScanBarcode, Save, CheckCircle2, XCircle, History, Zap } from "lucide-react";
import { toast } from "sonner";

const CLOTHING_KEYWORDS = ["เสื้อ", "กางเกง"];
const SIZES = ["SS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

type WelfareItem = {
  id: string;
  name: string;
};

type Distribution = {
  id: string;
  itemId: string;
  received: boolean;
  pendingSize: string | null;
  item: WelfareItem;
};

type Student = {
  id: string;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
  receiptType: string;
  distributions: Distribution[];
};

type ItemState = {
  itemId: string;
  name: string;
  received: boolean;
  reason: string;
  pendingSize: string;
};

type ScanRecord = {
  name: string;
  code: string;
  time: string;
  success: boolean;
};

export default function ScanPage() {
  const [barcode, setBarcode] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [itemStates, setItemStates] = useState<ItemState[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [quickMode, setQuickMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cache welfare items — โหลดครั้งเดียว ไม่ต้องดึงซ้ำทุกครั้งที่สแกน
  const cachedItemsRef = useRef<WelfareItem[] | null>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Focus input after save
  const focusInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
  }, []);

  const addHistory = useCallback((name: string, code: string, success: boolean) => {
    setHistory((prev) => [
      { name, code, time: new Date().toLocaleTimeString("th-TH"), success },
      ...prev.slice(0, 9),
    ]);
  }, []);

  async function handleScan() {
    if (!barcode.trim()) return;
    setLoading(true);

    try {
      // ถ้ามี cache welfare items แล้ว → ส่ง skipItems=true เพื่อประหยัด 1 query
      const skipItems = cachedItemsRef.current !== null;
      const res = await fetch(
        `/api/scan?barcode=${encodeURIComponent(barcode.trim())}&skipItems=${skipItems}`
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error);
        playBeep(false);
        addHistory("ไม่พบ", barcode, false);
        setStudent(null);
        setBarcode("");
        focusInput();
        return;
      }

      // อัปเดต cache welfare items ถ้าได้มาจาก API
      if (data.welfareItems) {
        cachedItemsRef.current = data.welfareItems;
      }
      const welfareItems = cachedItemsRef.current || [];

      const scannedStudent: Student = data.student;

      // สร้าง item states
      const states: ItemState[] = welfareItems.map((item: WelfareItem) => {
        const existing = scannedStudent.distributions.find(
          (d: Distribution) => d.itemId === item.id
        );
        return {
          itemId: item.id,
          name: item.name,
          received: existing ? existing.received : true,
          reason: "",
          pendingSize: existing?.pendingSize || "",
        };
      });

      // โหมดสแกนเร็ว: ถ้านักเรียนยังไม่เคยสแกน → บันทึก "รับทั้งหมด" อัตโนมัติ
      if (quickMode && scannedStudent.distributions.length === 0) {
        setBarcode("");
        playBeep(true);

        // บันทึกทันทีโดยไม่ต้องกด Enter อีกครั้ง
        const saveRes = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: scannedStudent.id,
            items: states.map((s) => ({
              itemId: s.itemId,
              received: true,
              reason: "",
              pendingSize: null,
            })),
          }),
        });

        if (saveRes.ok) {
          toast.success(
            `บันทึกสำเร็จ: ${scannedStudent.prefix}${scannedStudent.firstName} ${scannedStudent.lastName}`
          );
          addHistory(
            `${scannedStudent.prefix}${scannedStudent.firstName} ${scannedStudent.lastName}`,
            scannedStudent.studentCode,
            true
          );
          setStudent(null);
          setItemStates([]);
        } else {
          toast.error("บันทึกไม่สำเร็จ — เปิดรายละเอียดให้แก้ไข");
          setStudent(scannedStudent);
          setItemStates(states);
        }
        focusInput();
        return;
      }

      // โหมดปกติ: แสดงรายละเอียดให้ตรวจสอบก่อนบันทึก
      setStudent(scannedStudent);
      setItemStates(states);
      setBarcode("");
      playBeep(true);
    } catch {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!student) return;
    setSaving(true);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          items: itemStates.map((s) => ({
            itemId: s.itemId,
            received: s.received,
            reason: s.reason,
            pendingSize: s.pendingSize || null,
          })),
        }),
      });

      if (res.ok) {
        toast.success(
          `บันทึกสำเร็จ: ${student.prefix}${student.firstName} ${student.lastName}`
        );
        addHistory(
          `${student.prefix}${student.firstName} ${student.lastName}`,
          student.studentCode,
          true
        );
        setStudent(null);
        setItemStates([]);
        focusInput();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (student) {
        handleSave();
      } else {
        handleScan();
      }
    }
  }

  function toggleReceived(index: number) {
    setItemStates((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, received: !s.received, pendingSize: !s.received ? "" : s.pendingSize } : s
      )
    );
  }

  function isClothingItem(name: string) {
    return CLOTHING_KEYWORDS.some((kw) => name.includes(kw));
  }

  function setPendingSize(index: number, size: string) {
    setItemStates((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, pendingSize: size } : s
      )
    );
  }

  const receiptTypeLabels: Record<string, string> = {
    M1: "ม.1",
    M4_GENERAL: "ม.4 ทั่วไป",
    M4_LANG: "ม.4 อังกฤษ จีน ญี่ปุ่น",
  };

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">สแกน Barcode - ร้านสวัสดิการ</h1>
        <div className="flex items-center gap-2">
          <Switch
            id="quick-mode"
            checked={quickMode}
            onCheckedChange={setQuickMode}
          />
          <Label htmlFor="quick-mode" className="flex items-center gap-1.5 cursor-pointer text-sm">
            <Zap className={`w-4 h-4 ${quickMode ? "text-yellow-500" : "text-muted-foreground"}`} />
            สแกนเร็ว
          </Label>
        </div>
      </div>

      {/* Quick Mode Info */}
      {quickMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <strong>โหมดสแกนเร็ว:</strong> สแกนแล้วบันทึก &quot;รับทั้งหมด&quot; ทันที ไม่ต้องกด Enter อีกครั้ง
          (ถ้านักเรียนเคยสแกนแล้ว จะแสดงรายละเอียดให้แก้ไขตามปกติ)
        </div>
      )}

      {/* Scan Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-2.5 w-5 h-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="สแกน Barcode หรือพิมพ์เลขประจำตัว แล้วกด Enter..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="pl-11 text-lg h-12"
                autoFocus
                disabled={loading}
              />
            </div>
            <Button
              onClick={student ? handleSave : handleScan}
              className="h-12 px-6"
              disabled={loading || saving}
            >
              {student ? (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  บันทึก (Enter)
                </>
              ) : (
                <>
                  <ScanBarcode className="w-4 h-4 mr-2" />
                  {loading ? "กำลังค้น..." : "สแกน"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Info + Items */}
        <div className="lg:col-span-2 space-y-4">
          {student ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    ข้อมูลนักเรียน
                    <Badge>{receiptTypeLabels[student.receiptType]}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">เลขประจำตัว:</span>
                      <p className="font-mono text-lg font-bold">
                        {student.studentCode}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ชื่อ-นามสกุล:</span>
                      <p className="text-lg font-bold">
                        {student.prefix}
                        {student.firstName} {student.lastName}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ชั้น/ห้อง:</span>
                      <p className="font-bold">
                        {student.level}/{student.room}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    รายการสินค้าสวัสดิการ
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    ติดเครื่องหมายถูก = ได้รับ | เอาออก = ไม่ได้รับ
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {itemStates.map((item, index) => (
                      <div key={item.itemId}>
                        <div
                          className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-colors ${
                            item.received
                              ? "border-green-200 bg-green-50"
                              : "border-red-200 bg-red-50"
                          } ${!item.received && isClothingItem(item.name) ? "rounded-b-none" : ""}`}
                        >
                          <Checkbox
                            id={item.itemId}
                            checked={item.received}
                            onCheckedChange={() => toggleReceived(index)}
                            className="w-6 h-6"
                          />
                          <Label
                            htmlFor={item.itemId}
                            className="flex-1 text-lg font-medium cursor-pointer"
                          >
                            {item.name}
                          </Label>
                          {item.received ? (
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-600" />
                          )}
                        </div>
                        {/* Show size selector for clothing items when not received */}
                        {!item.received && isClothingItem(item.name) && (
                          <div className="border-2 border-t-0 border-red-200 bg-red-50 rounded-b-lg px-4 pb-4 pt-2">
                            <div className="flex items-center gap-3">
                              <Label className="text-sm font-medium whitespace-nowrap">
                                เลือกไซส์ที่ต้องการรับภายหลัง:
                              </Label>
                              <Select
                                value={item.pendingSize}
                                onValueChange={(val) => setPendingSize(index, val)}
                              >
                                <SelectTrigger className="w-32 bg-white">
                                  <SelectValue placeholder="เลือกไซส์" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SIZES.map((size) => (
                                    <SelectItem key={size} value={size}>
                                      {size}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleSave}
                    className="w-full mt-6 h-12 text-lg"
                    disabled={saving}
                  >
                    <Save className="w-5 h-5 mr-2" />
                    {saving ? "กำลังบันทึก..." : "บันทึก (กด Enter)"}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <ScanBarcode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">พร้อมสแกน Barcode</p>
                <p className="text-sm mt-1">
                  ใช้เครื่องอ่าน Barcode หรือพิมพ์เลขประจำตัวนักเรียน
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5" />
              ประวัติล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                ยังไม่มีประวัติ
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((record, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-md border ${
                      record.success
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{record.name}</span>
                      {record.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{record.code}</span>
                      <span>{record.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
