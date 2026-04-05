import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import CreateReceiptClient from "./create-receipt-client";

export default async function CreateReceiptPage() {
  const user = await getSession();
  if (!user) redirect("/");
  return <CreateReceiptClient isAdmin={user.role === "ADMIN"} />;
}
