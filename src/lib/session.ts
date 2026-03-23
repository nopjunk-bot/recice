import { cookies } from "next/headers";

export type Department = "finance" | "welfare" | "academic" | "admin";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "FINANCE" | "WELFARE_STAFF" | "ACADEMIC";
  department?: Department;
};

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  if (!session) return null;
  try {
    return JSON.parse(Buffer.from(session.value, "base64").toString());
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}
