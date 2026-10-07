import { redirect } from "next/navigation";

export default function WeeklyReportRedirect() {
  redirect("/admin/reports");
}
