import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import DocumentRequestsClient from "./document-requests-client";

export default async function DocumentRequestsPage() {
  const user = await getSession();
  if (!user) redirect("/");

  const limit = 50;

  const [requests, total, counts] = await Promise.all([
    prisma.documentRequest.findMany({
      include: {
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
        receipt: {
          select: {
            receiptNumber: true,
            totalAmount: true,
            receiptType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.documentRequest.count(),
    prisma.documentRequest.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const statusCounts = { PENDING: 0, COMPLETED: 0, REJECTED: 0 };
  for (const c of counts) {
    statusCounts[c.status] = c._count.status;
  }

  return (
    <DocumentRequestsClient
      initialData={{
        requests: requests.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          pickupDate: r.pickupDate?.toISOString() ?? null,
        })),
        total,
        page: 1,
        totalPages: Math.ceil(total / limit),
        statusCounts,
      }}
    />
  );
}
