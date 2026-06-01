import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type UpdateEntry = {
  id: string;
  level: string;
  room: string;
};

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { updates: UpdateEntry[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates = body.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json(
      { error: "ไม่มีรายการที่ต้องอัปเดต" },
      { status: 400 }
    );
  }

  // Validate shape
  for (const u of updates) {
    if (typeof u.id !== "string" || typeof u.level !== "string" || typeof u.room !== "string") {
      return NextResponse.json(
        { error: "รูปแบบข้อมูลไม่ถูกต้อง" },
        { status: 400 }
      );
    }
  }

  // Update in a transaction
  const result = await prisma.$transaction(
    updates.map((u) =>
      prisma.student.update({
        where: { id: u.id },
        data: { level: u.level, room: u.room },
      })
    )
  );

  return NextResponse.json({
    updated: result.length,
  });
}
