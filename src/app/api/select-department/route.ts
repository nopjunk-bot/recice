import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Department } from "@/lib/session";

const validDepartments: Department[] = ["finance", "welfare", "academic", "admin"];

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessionData = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString()
    );

    const { department } = await req.json();

    if (!department || !validDepartments.includes(department)) {
      return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }

    // เฉพาะ ADMIN เท่านั้นที่เลือกฝ่ายได้
    if (sessionData.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // อัปเดต session cookie เพิ่ม department
    sessionData.department = department;
    cookieStore.set("session", Buffer.from(JSON.stringify(sessionData)).toString("base64"), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}

// DELETE: ล้าง department (สำหรับ ADMIN เปลี่ยนฝ่าย)
export async function DELETE() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessionData = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString()
    );

    delete sessionData.department;
    cookieStore.set("session", Buffer.from(JSON.stringify(sessionData)).toString("base64"), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}
