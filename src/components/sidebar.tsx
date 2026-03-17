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
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard },
  { href: "/import", label: "นำเข้าข้อมูล", icon: Upload },
  { href: "/receipts", label: "พิมพ์ใบเสร็จ", icon: FileText },
  { href: "/payment-scan", label: "ยืนยันค้างชำระ", icon: ClipboardCheck },
  { href: "/scan", label: "สแกน Barcode", icon: ScanBarcode },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
  { href: "/staff", label: "จัดการพนักงาน", icon: Users },
  { href: "/student-matching", label: "จับคู่นักเรียน", icon: GitCompareArrows },
  { href: "/manage-students", label: "ลบข้อมูลนักเรียน", icon: UserX },
];

export default function Sidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const roleLabel =
    userRole === "ADMIN"
      ? "ผู้ดูแลระบบ"
      : userRole === "DATA_ENTRY"
      ? "พนักงานนำเข้าข้อมูล"
      : "พนักงานร้านสวัสดิการ";

  // Filter nav items by role
  const filteredItems = navItems.filter((item) => {
    if (userRole === "ADMIN") return true;
    if (userRole === "DATA_ENTRY") {
      return ["/dashboard", "/import", "/receipts"].includes(item.href);
    }
    if (userRole === "WELFARE_STAFF") {
      return ["/dashboard", "/scan", "/reports"].includes(item.href);
    }
    return false;
  });

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 bg-white border-r min-h-screen flex flex-col">
      <div className="p-4 border-b">
        <h1 className="font-bold text-lg">ระบบร้านสวัสดิการ</h1>
        <p className="text-xs text-muted-foreground mt-1">{userName}</p>
        <p className="text-xs text-blue-600">{roleLabel}</p>
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
      <div className="p-2 border-t">
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
