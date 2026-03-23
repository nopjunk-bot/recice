import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import ReportsClient from "./reports-client";

export default async function ReportsPage() {
  const user = await getSession();
  if (!user) redirect("/");

  // โหลดข้อมูลแท็บแรก (not-received) มาพร้อม HTML เลย
  const notReceived = await prisma.welfareDistribution.findMany({
    where: { received: false },
    select: {
      id: true,
      received: true,
      notReceivedReason: true,
      scannedAt: true,
      student: {
        select: {
          studentCode: true,
          prefix: true,
          firstName: true,
          lastName: true,
          level: true,
          room: true,
        },
      },
      item: { select: { name: true } },
    },
    orderBy: { scannedAt: "desc" },
  });

  return (
    <ReportsClient
      initialNotReceived={notReceived.map((d) => ({
        ...d,
        scannedAt: d.scannedAt.toISOString(),
      }))}
    />
  );
}
