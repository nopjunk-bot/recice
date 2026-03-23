import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/login",
  "/api/auth",
  "/academic",
  "/api/academic",
  "/document-request",
  "/api/document-request",
  "/select-department",
  "/api/select-department",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get("session");
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ADMIN ต้องเลือกฝ่ายก่อนเข้าใช้งาน
  try {
    const sessionData = JSON.parse(
      Buffer.from(session.value, "base64").toString()
    );
    if (sessionData.role === "ADMIN" && !sessionData.department) {
      return NextResponse.redirect(new URL("/select-department", request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
