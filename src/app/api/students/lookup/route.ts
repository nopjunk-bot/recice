import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "กรุณาระบุเลขประจำตัว" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { studentCode: code.trim() },
    select: {
      id: true,
      studentCode: true,
      prefix: true,
      firstName: true,
      lastName: true,
      level: true,
      room: true,
      receiptType: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "ไม่พบนักเรียน" }, { status: 404 });
  }

  return NextResponse.json({ student });
}
