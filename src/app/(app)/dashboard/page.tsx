import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, ScanBarcode, AlertTriangle } from "lucide-react";
import { unstable_cache } from "next/cache";

// Cache ผลนับสถิติไว้ 60 วินาที — ไม่ต้อง query ฐานข้อมูลทุกครั้งที่เปิดหน้า
const getDashboardStats = unstable_cache(
  async () => {
    const [totalStudents, totalReceipts, totalScanned, notReceived] =
      await Promise.all([
        prisma.student.count(),
        prisma.receipt.count(),
        prisma.welfareDistribution.count({
          where: { received: true },
        }),
        prisma.welfareDistribution.count({
          where: { received: false },
        }),
      ]);
    return { totalStudents, totalReceipts, totalScanned, notReceived };
  },
  ["dashboard-stats"],
  { revalidate: 60 } // รีเฟรชข้อมูลใหม่ทุก 60 วินาที
);

export default async function DashboardPage() {
  // session ถูกตรวจแล้วที่ layout — ไม่ต้องตรวจซ้ำ
  const { totalStudents, totalReceipts, totalScanned, notReceived } =
    await getDashboardStats();

  const stats = [
    {
      label: "นักเรียนทั้งหมด",
      value: totalStudents,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "ใบเสร็จที่พิมพ์แล้ว",
      value: totalReceipts,
      icon: FileText,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "สแกนรับสินค้าแล้ว",
      value: totalScanned,
      icon: ScanBarcode,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "ไม่ได้รับสินค้า",
      value: notReceived,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">หน้าหลัก</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div className={`p-2 rounded-md ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${stat.color}`}>
                  {stat.value.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
