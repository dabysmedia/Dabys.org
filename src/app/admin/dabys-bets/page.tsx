import { redirect } from "next/navigation";

export default function AdminDabysBetsRedirect() {
  redirect("/admin/casino?tab=dabys-bets");
}
