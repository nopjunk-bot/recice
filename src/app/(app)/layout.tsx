import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Sidebar from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userName={user.name} userRole={user.role} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
