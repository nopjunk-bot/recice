import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rooms = await prisma.student.findMany({
    select: { room: true },
    distinct: ["room"],
    orderBy: { room: "asc" },
  });

  return NextResponse.json(rooms.map((r) => r.room));
}
