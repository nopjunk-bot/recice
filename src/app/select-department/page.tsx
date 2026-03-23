import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import SelectDepartmentClient from "./select-department-client";

export default async function SelectDepartmentPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  // ถ้าไม่ใช่ ADMIN → auto-redirect ไปหน้าที่เหมาะสมทันที (ไม่ต้องเลือก)
  if (user.role === "ACADEMIC") redirect("/academic");
  if (user.role === "FINANCE") redirect("/dashboard");
  if (user.role === "WELFARE_STAFF") redirect("/dashboard");

  // ถ้า ADMIN เลือกฝ่ายไว้แล้ว → ไป dashboard
  if (user.department) redirect("/dashboard");

  // ADMIN ยังไม่ได้เลือกฝ่าย → แสดงหน้าเลือก
  return <SelectDepartmentClient userName={user.name} />;
}
