import { redirect } from "next/navigation";

export default function DailyReportRedirect() {
  redirect("/admin/reports");
}
