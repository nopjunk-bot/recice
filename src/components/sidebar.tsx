"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  FileText,
  ScanBarcode,
  BarChart3,
  Users,
  LogOut,
  UserX,
  ClipboardCheck,
  GitCompareArrows,
  FileSearch,
  FilePlus2,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Department } from "@/lib/session";

const navItems = [
  { href: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard },
  { href: "/import", label: "นำเข้าข้อมูล", icon: Upload },
  { href: "/receipts", label: "พิมพ์ใบเสร็จ", icon: FileText },
  { href: "/create-receipt", label: "สร้างใบเสร็จชั่วคราว", icon: FilePlus2 },
  { href: "/payment-scan", label: "ยืนยันค้างชำระ", icon: ClipboardCheck },
  { href: "/scan", label: "สแกน Barcode", icon: ScanBarcode },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
  { href: "/staff", label: "จัดการพนักงาน", icon: Users },
  { href: "/student-matching", label: "จับคู่นักเรียน", icon: GitCompareArrows },
  { href: "/manage-students", label: "ลบข้อมูลนักเรียน", icon: UserX },
  { href: "/document-requests", label: "คำขอเอกสาร", icon: FileSearch },
];

// เมนูที่แต่ละฝ่ายเข้าถึงได้
const departmentMenus: Record<Department, string[]> = {
  finance: ["/dashboard", "/import", "/receipts", "/create-receipt", "/payment-scan", "/document-requests"],
  welfare: ["/dashboard", "/scan", "/reports"],
  admin: navItems.map((item) => item.href), // ทุกเมนู
  academic: ["/dashboard"], // ไม่ควรเห็น sidebar เลย แต่ใส่ไว้กันกรณีพิเศษ
};

const departmentLabels: Record<Department, string> = {
  finance: "ฝ่ายการเงิน",
  welfare: "ฝ่ายร้านสวัสดิการ",
  admin: "ผู้ดูแลระบบ",
  academic: "ฝ่ายวิชาการ",
};

export default function Sidebar({
  userName,
  userRole,
  department,
}: {
  userName: string;
  userRole: string;
  department: Department;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const allowedMenus = departmentMenus[department] || [];
  const filteredItems = navItems.filter((item) => allowedMenus.includes(item.href));
  const isAdmin = userRole === "ADMIN";

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  async function handleSwitchDepartment() {
    await fetch("/api/select-department", { method: "DELETE" });
    router.push("/select-department");
    router.refresh();
  }

  return (
    <aside className="w-64 bg-white border-r min-h-screen flex flex-col">
      <div className="p-4 border-b">
        <h1 className="font-bold text-lg">ระบบร้านสวัสดิการ</h1>
        <p className="text-xs text-muted-foreground mt-1">{userName}</p>
        <p className="text-xs text-blue-600">{departmentLabels[department]}</p>
      </div>
      <nav className="flex-1 p-2">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors mb-1",
                isActive
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t space-y-1">
        {isAdmin && (
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-600"
            onClick={handleSwitchDepartment}
          >
            <ArrowLeftRight className="w-5 h-5 mr-3" />
            เปลี่ยนฝ่าย
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-600"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          ออกจากระบบ
        </Button>
      </div>
    </aside>
  );
}
