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
import {
  ScanBarcode,
  Save,
  CheckCircle2,
  XCircle,
  History,
  Zap,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudUpload,
  Loader2,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import {
  cacheAllData,
  lookupStudentByBarcode,
  getWelfareItems as getOfflineWelfareItems,
  queueScan,
  updateCachedStudentDistributions,
  getCachedStudentCount,
  getLastSyncedAt,
} from "@/lib/offline-db";

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
  offline?: boolean;
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

  // ─── Offline Mode ───
  const { isOnline } = useOnlineStatus();
  const { pendingCount, isSyncing, syncPending, refreshPendingCount } =
    useOfflineSync(isOnline);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);
  const [lastSynced, setLastSynced] = useState<string>("");
  const [isCaching, setIsCaching] = useState(false);

  // Cache welfare items — โหลดครั้งเดียว ไม่ต้องดึงซ้ำทุกครั้งที่สแกน
  const cachedItemsRef = useRef<WelfareItem[] | null>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ─── โหลดข้อมูลลง IndexedDB เมื่อออนไลน์ ───
  const loadOfflineCache = useCallback(async () => {
    setIsCaching(true);
    try {
      const res = await fetch("/api/scan/offline-data");
      if (!res.ok) return;
      const data = await res.json();
      await cacheAllData(data.students, data.welfareItems);
      setCacheCount(data.students.length);
      setCacheReady(true);
      setLastSynced(
        new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      // ถ้าโหลดไม่ได้ ลองใช้ cache เดิม
      const count = await getCachedStudentCount();
      if (count > 0) {
        setCacheReady(true);
        setCacheCount(count);
        const syncDate = await getLastSyncedAt();
        if (syncDate) {
          setLastSynced(
            syncDate.toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit",
            })
          );
        }
      }
    } finally {
      setIsCaching(false);
    }
  }, []);

  // เมื่อเปิดหน้า: โหลด cache (ถ้าออนไลน์) หรือใช้ cache เดิม (ถ้าออฟไลน์)
  useEffect(() => {
    if (isOnline) {
      loadOfflineCache();
    } else {
      // ออฟไลน์: ตรวจสอบว่ามี cache อยู่ไหม
      getCachedStudentCount().then((count) => {
        if (count > 0) {
          setCacheReady(true);
          setCacheCount(count);
          getLastSyncedAt().then((d) => {
            if (d)
              setLastSynced(
                d.toLocaleTimeString("th-TH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              );
          });
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input after save
  const focusInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
  }, []);

  const addHistory = useCallback(
    (name: string, code: string, success: boolean, offline = false) => {
      setHistory((prev) => [
        {
          name,
          code,
          time: new Date().toLocaleTimeString("th-TH"),
          success,
          offline,
        },
        ...prev.slice(0, 9),
      ]);
    },
    []
  );

  // ─── สร้าง item states จาก student + welfare items ───
  function buildItemStates(
    scannedStudent: Student,
    welfareItems: WelfareItem[]
  ): ItemState[] {
    return welfareItems.map((item) => {
      const existing = scannedStudent.distributions.find(
        (d) => d.itemId === item.id
      );
      return {
        itemId: item.id,
        name: item.name,
        received: existing ? existing.received : true,
        reason: "",
        pendingSize: existing?.pendingSize || "",
      };
    });
  }

  // ─── บันทึกแบบออฟไลน์ ───
  async function saveOffline(
    targetStudent: Student,
    items: { itemId: string; received: boolean; reason: string; pendingSize: string | null }[]
  ) {
    const studentName = `${targetStudent.prefix}${targetStudent.firstName} ${targetStudent.lastName}`;
    await queueScan({
      studentId: targetStudent.id,
      studentName,
      items: items.map((s) => ({
        itemId: s.itemId,
        received: s.received,
        reason: s.reason,
        pendingSize: s.pendingSize,
      })),
      timestamp: Date.now(),
    });

    // อัปเดต cache ในเครื่องด้วย เพื่อให้สแกนซ้ำเห็นข้อมูลล่าสุด
    await updateCachedStudentDistributions(
      targetStudent.studentCode,
      items.map((s) => ({
        itemId: s.itemId,
        received: s.received,
        pendingSize: s.pendingSize,
      }))
    );

    await refreshPendingCount();
    toast.success(`บันทึกออฟไลน์: ${studentName} (รอ sync)`);
    addHistory(studentName, targetStudent.studentCode, true, true);
  }

  // ─── SCAN ───
  async function handleScan() {
    if (!barcode.trim()) return;
    setLoading(true);

    try {
      let scannedStudent: Student;
      let welfareItems: WelfareItem[];

      if (isOnline) {
        // ── ออนไลน์: ใช้ API เหมือนเดิม ──
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

        if (data.welfareItems) {
          cachedItemsRef.current = data.welfareItems;
        }
        welfareItems = cachedItemsRef.current || [];
        scannedStudent = data.student;
      } else {
        // ── ออฟไลน์: ค้นจาก IndexedDB ──
        if (!cacheReady) {
          toast.error("ไม่มีข้อมูลในแคช กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อโหลดข้อมูลก่อน");
          setLoading(false);
          return;
        }

        const cached = await lookupStudentByBarcode(barcode.trim());
        if (!cached) {
          toast.error("ไม่พบข้อมูลนักเรียน (ออฟไลน์)");
          playBeep(false);
          addHistory("ไม่พบ", barcode, false, true);
          setStudent(null);
          setBarcode("");
          focusInput();
          return;
        }

        scannedStudent = cached as Student;
        welfareItems = await getOfflineWelfareItems();
      }

      const states = buildItemStates(scannedStudent, welfareItems);

      // โหมดสแกนเร็ว
      if (quickMode && scannedStudent.distributions.length === 0) {
        setBarcode("");
        playBeep(true);

        const quickItems = states.map((s) => ({
          itemId: s.itemId,
          received: true,
          reason: "",
          pendingSize: null,
        }));

        if (isOnline) {
          const saveRes = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: scannedStudent.id,
              items: quickItems,
            }),
          });

          if (saveRes.ok) {
            const name = `${scannedStudent.prefix}${scannedStudent.firstName} ${scannedStudent.lastName}`;
            toast.success(`บันทึกสำเร็จ: ${name}`);
            addHistory(name, scannedStudent.studentCode, true);
            setStudent(null);
            setItemStates([]);
          } else {
            toast.error("บันทึกไม่สำเร็จ — เปิดรายละเอียดให้แก้ไข");
            setStudent(scannedStudent);
            setItemStates(states);
          }
        } else {
          // Quick save แบบออฟไลน์
          await saveOffline(scannedStudent, quickItems);
          setStudent(null);
          setItemStates([]);
        }
        focusInput();
        return;
      }

      // โหมดปกติ
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

  // ─── SAVE ───
  async function handleSave() {
    if (!student) return;
    setSaving(true);

    try {
      const items = itemStates.map((s) => ({
        itemId: s.itemId,
        received: s.received,
        reason: s.reason,
        pendingSize: s.pendingSize || null,
      }));

      if (isOnline) {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: student.id, items }),
        });

        if (res.ok) {
          const name = `${student.prefix}${student.firstName} ${student.lastName}`;
          toast.success(`บันทึกสำเร็จ: ${name}`);
          addHistory(name, student.studentCode, true);
          setStudent(null);
          setItemStates([]);
          focusInput();
        } else {
          const data = await res.json();
          toast.error(data.error);
        }
      } else {
        // บันทึกแบบออฟไลน์
        await saveOffline(student, items);
        setStudent(null);
        setItemStates([]);
        focusInput();
      }
    } catch {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  // ─── Manual Sync ───
  async function handleManualSync() {
    const { synced, failed } = await syncPending();
    if (synced > 0 && failed === 0) {
      toast.success(`Sync สำเร็จ ${synced} รายการ`);
    } else if (synced > 0 && failed > 0) {
      toast.warning(`Sync สำเร็จ ${synced} รายการ, ล้มเหลว ${failed} รายการ`);
    } else if (failed > 0) {
      toast.error(`Sync ล้มเหลว ${failed} รายการ`);
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
        i === index
          ? {
              ...s,
              received: !s.received,
              pendingSize: !s.received ? "" : s.pendingSize,
            }
          : s
      )
    );
  }

  function isClothingItem(name: string) {
    return CLOTHING_KEYWORDS.some((kw) => name.includes(kw));
  }

  function setPendingSizeValue(index: number, size: string) {
    setItemStates((prev) =>
      prev.map((s, i) => (i === index ? { ...s, pendingSize: size } : s))
    );
  }

  const receiptTypeLabels: Record<string, string> = {
    M1: "ม.1",
    M4_GENERAL: "ม.4 ทั่วไป",
    M4_LANG: "ม.4 อังกฤษ จีน ญี่ปุ่น",
  };

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>
      {/* ─── Header + Status ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">สแกน Barcode - ร้านสวัสดิการ</h1>
        <div className="flex items-center gap-3">
          {/* Online/Offline Status */}
          {isOnline ? (
            <Badge className="bg-green-100 text-green-700 gap-1">
              <Wifi className="w-3 h-3" />
              ออนไลน์
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-700 gap-1">
              <WifiOff className="w-3 h-3" />
              ออฟไลน์
            </Badge>
          )}

          {/* Quick Mode Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="quick-mode"
              checked={quickMode}
              onCheckedChange={setQuickMode}
            />
            <Label
              htmlFor="quick-mode"
              className="flex items-center gap-1.5 cursor-pointer text-sm"
            >
              <Zap
                className={`w-4 h-4 ${quickMode ? "text-yellow-500" : "text-muted-foreground"}`}
              />
              สแกนเร็ว
            </Label>
          </div>
        </div>
      </div>

      {/* ─── Offline Info Bar ─── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Cache status */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Database className="w-3.5 h-3.5" />
          {isCaching ? (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              กำลังโหลดข้อมูล...
            </span>
          ) : cacheReady ? (
            <span>
              แคช: {cacheCount.toLocaleString()} คน
              {lastSynced && ` | อัปเดต: ${lastSynced}`}
            </span>
          ) : (
            <span className="text-orange-600">ยังไม่มีแคช</span>
          )}
        </div>

        {/* Refresh cache button */}
        {isOnline && (
          <Button
            variant="ghost"
            size="sm"
            onClick={loadOfflineCache}
            disabled={isCaching}
            className="h-7 text-xs"
          >
            <RefreshCw
              className={`w-3 h-3 mr-1 ${isCaching ? "animate-spin" : ""}`}
            />
            รีเฟรชแคช
          </Button>
        )}

        {/* Pending sync count */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-100 text-orange-700 gap-1">
              <CloudUpload className="w-3 h-3" />
              รอ sync: {pendingCount} รายการ
            </Badge>
            {isOnline && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="h-7 text-xs"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    กำลัง sync...
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-3 h-3 mr-1" />
                    Sync ตอนนี้
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Offline mode warning */}
      {!isOnline && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
          <strong>โหมดออฟไลน์:</strong> ระบบจะใช้ข้อมูลที่เก็บไว้ในเครื่อง
          ผลการสแกนจะถูกบันทึกไว้รอ และจะ sync อัตโนมัติเมื่อกลับมาออนไลน์
          {!cacheReady && (
            <p className="mt-1 text-red-600 font-medium">
              ยังไม่มีข้อมูลในแคช ไม่สามารถสแกนได้ กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อโหลดข้อมูลก่อน
            </p>
          )}
        </div>
      )}

      {/* Quick Mode Info */}
      {quickMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <strong>โหมดสแกนเร็ว:</strong> สแกนแล้วบันทึก &quot;รับทั้งหมด&quot;
          ทันที ไม่ต้องกด Enter อีกครั้ง (ถ้านักเรียนเคยสแกนแล้ว
          จะแสดงรายละเอียดให้แก้ไขตามปกติ)
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
                    {!isOnline && (
                      <Badge className="bg-orange-100 text-orange-700 text-xs">
                        ออฟไลน์
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        เลขประจำตัว:
                      </span>
                      <p className="font-mono text-lg font-bold">
                        {student.studentCode}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        ชื่อ-นามสกุล:
                      </span>
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
                                onValueChange={(val) =>
                                  setPendingSizeValue(index, val)
                                }
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
                    {saving
                      ? "กำลังบันทึก..."
                      : isOnline
                        ? "บันทึก (กด Enter)"
                        : "บันทึกออฟไลน์ (กด Enter)"}
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
                {!isOnline && cacheReady && (
                  <p className="text-sm mt-2 text-orange-600">
                    กำลังใช้งานแบบออฟไลน์ (แคช {cacheCount.toLocaleString()} คน)
                  </p>
                )}
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
                        ? record.offline
                          ? "border-orange-200 bg-orange-50"
                          : "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{record.name}</span>
                      <div className="flex items-center gap-1">
                        {record.offline && (
                          <WifiOff className="w-3 h-3 text-orange-500" />
                        )}
                        {record.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
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
