"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Banknote, ShoppingBag, Settings, GraduationCap } from "lucide-react";

const departments = [
  {
    id: "finance",
    label: "ฝ่ายการเงิน",
    description: "นำเข้าข้อมูล, พิมพ์ใบเสร็จ, ยืนยันค้างชำระ, คำขอเอกสาร",
    icon: Banknote,
    color: "text-blue-600",
    bg: "bg-blue-50 hover:bg-blue-100 border-blue-200",
  },
  {
    id: "welfare",
    label: "ฝ่ายร้านสวัสดิการ",
    description: "สแกน Barcode, รายงาน",
    icon: ShoppingBag,
    color: "text-green-600",
    bg: "bg-green-50 hover:bg-green-100 border-green-200",
  },
  {
    id: "admin",
    label: "ผู้ดูแลระบบ",
    description: "เข้าถึงทุกเมนู, จัดการพนักงาน, ลบข้อมูลนักเรียน",
    icon: Settings,
    color: "text-purple-600",
    bg: "bg-purple-50 hover:bg-purple-100 border-purple-200",
  },
  {
    id: "academic",
    label: "ฝ่ายวิชาการ",
    description: "ดูข้อมูลนักเรียนที่ยังไม่ชำระเงิน",
    icon: GraduationCap,
    color: "text-orange-600",
    bg: "bg-orange-50 hover:bg-orange-100 border-orange-200",
  },
];

export default function SelectDepartmentClient({ userName }: { userName: string }) {
  const router = useRouter();

  async function selectDepartment(departmentId: string) {
    // ฝ่ายวิชาการ → ไป /academic โดยตรง
    if (departmentId === "academic") {
      router.push("/academic");
      return;
    }

    // ฝ่ายอื่นๆ → ตั้ง department ใน session แล้วไป dashboard
    const res = await fetch("/api/select-department", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department: departmentId }),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-2xl px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">ยินดีต้อนรับ, {userName}</h1>
          <p className="text-muted-foreground mt-2">เลือกฝ่ายงานที่ต้องการเข้าใช้</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {departments.map((dept) => {
            const Icon = dept.icon;
            return (
              <Card
                key={dept.id}
                className={`cursor-pointer border-2 transition-all ${dept.bg}`}
                onClick={() => selectDepartment(dept.id)}
              >
                <CardContent className="pt-6 text-center">
                  <Icon className={`w-12 h-12 mx-auto mb-3 ${dept.color}`} />
                  <h2 className="text-lg font-bold">{dept.label}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {dept.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
