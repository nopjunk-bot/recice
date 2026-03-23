import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import type { Department } from "@/lib/session";
import Sidebar from "@/components/sidebar";

function getDepartment(role: string, sessionDepartment?: Department): Department {
  // ADMIN ใช้ department ที่เลือกไว้
  if (role === "ADMIN") return sessionDepartment || "admin";
  // ฝ่ายอื่นๆ derive จาก role อัตโนมัติ
  if (role === "FINANCE") return "finance";
  if (role === "WELFARE_STAFF") return "welfare";
  if (role === "ACADEMIC") return "academic";
  return "admin";
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  // ADMIN ที่ยังไม่ได้เลือกฝ่าย → ไปเลือกก่อน
  if (user.role === "ADMIN" && !user.department) redirect("/select-department");

  const department = getDepartment(user.role, user.department);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userName={user.name} userRole={user.role} department={department} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
