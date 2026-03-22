"use client";

import { useState } from "react";
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
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  RotateCcw,
  FlaskConical,
} from "lucide-react";
import { toast, Toaster } from "sonner";

type RequestResult = {
  studentCode: string;
  studentFullName: string;
  receiptNumber: string;
  round: number;
  pickupDate: string;
};

// ช่วงเวลาเปิดระบบ (แสดงให้ดูเป็นข้อมูลอ้างอิง)
const REQUEST_ROUNDS = [
  {
    round: 1,
    label: "รอบที่ 1",
    dateRange: "5 - 7 เมษายน 2569",
  },
  {
    round: 2,
    label: "รอบที่ 2",
    dateRange: "18 - 30 เมษายน 2569",
  },
];

export default function DocumentRequestTestPage() {
  const [studentCode, setStudentCode] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<RequestResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentCode.trim() || !receiptNumber.trim() || !studentName.trim()) {
      toast.error("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/document-request/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentCode: studentCode.trim(),
          receiptNumber: receiptNumber.trim(),
          studentName: studentName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      setResult(data.request);
      setSubmitted(true);
      toast.success("ส่งคำขอเรียบร้อยแล้ว");
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStudentCode("");
    setReceiptNumber("");
    setStudentName("");
    setSubmitted(false);
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Toaster richColors position="top-center" />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ระบบขอเอกสารใบสำคัญเบิกเงินสวัสดิการ
            <br />
            เกี่ยวกับการศึกษาบุตร
          </h1>
        </div>

        {/* แถบแจ้งเตือนโหมดทดสอบ */}
        <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-300 rounded-xl">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-purple-600 shrink-0" />
            <div>
              <p className="font-bold text-purple-800 text-lg">โหมดทดสอบ</p>
              <p className="text-sm text-purple-700">
                หน้านี้สำหรับทดสอบเท่านั้น สามารถกรอกฟอร์มได้ตลอดเวลาโดยไม่ต้องรอช่วงเวลาเปิดระบบ
              </p>
            </div>
          </div>
        </div>

        {/* ช่วงเวลาเปิดระบบ */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              ช่วงเวลาเปิดให้ขอเอกสาร Online
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {REQUEST_ROUNDS.map((r) => (
              <div
                key={r.round}
                className="flex items-center justify-between p-3 rounded-lg border bg-green-50 border-green-200"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="font-medium">{r.label}: </span>
                    <span>{r.dateRange}</span>
                  </div>
                </div>
                <Badge className="bg-green-600 text-white">เปิดอยู่ (ทดสอบ)</Badge>
              </div>
            ))}

            <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                ผู้ปกครองที่ขอเอกสาร สามารถรับเอกสารได้หลังจากดำเนินการขอเป็นเวลา{" "}
                <strong>3 วันทำการ</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ฟอร์มหรือผลลัพธ์ */}
        {!submitted ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">กรอกข้อมูลเพื่อขอเอกสาร</CardTitle>
              <CardDescription>
                กรอกหมายเลขประจำตัวนักเรียน เลขที่ใบเสร็จ และชื่อของนักเรียน
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="studentCode">
                    หมายเลขประจำตัวนักเรียน <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="studentCode"
                    placeholder="เช่น 12345"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiptNumber">
                    เลขที่ใบเสร็จ <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="receiptNumber"
                    placeholder="เช่น 00001/1/2569"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studentName">
                    ชื่อของนักเรียน <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="studentName"
                    placeholder="ไม่ต้องพิมพ์คำนำหน้า เช่น สมชาย ใจดี"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                      กำลังส่งคำขอ...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      ส่งคำขอเอกสาร
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-200">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-green-700">
                    ส่งคำขอเรียบร้อยแล้ว
                  </CardTitle>
                  <CardDescription>
                    ระบบบันทึกคำขอของท่านเรียบร้อยแล้ว
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ข้อมูลที่ส่ง */}
              {result && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">รหัสนักเรียน:</span>
                    <span className="font-medium">{result.studentCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ชื่อนักเรียน:</span>
                    <span className="font-medium">{result.studentFullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">เลขที่ใบเสร็จ:</span>
                    <span className="font-medium">{result.receiptNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">รอบที่ขอ:</span>
                    <span className="font-medium">รอบที่ {result.round}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">วันรับเอกสาร:</span>
                    <span className="font-medium">{result.pickupDate}</span>
                  </div>
                </div>
              )}

              {/* ข้อความสำคัญ */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium text-center leading-relaxed">
                  ผู้ปกครองรับเอกสารฉบับจริงที่ห้องการเงินเท่านั้น
                  <br />
                  สามารถรับได้ในวันและเวลาราชการเท่านั้น
                  <br />
                  สามารถรับเอกสารได้ภายในวันที่{" "}
                  {result?.pickupDate || ""}
                </p>
              </div>

              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                ส่งคำขอใหม่
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
