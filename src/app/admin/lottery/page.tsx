import { redirect } from "next/navigation";

export default function AdminLotteryRedirect() {
  redirect("/admin/casino?tab=lottery");
}
