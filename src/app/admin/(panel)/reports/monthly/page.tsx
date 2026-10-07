import { redirect } from "next/navigation";

export default function MonthlyReportRedirect() {
  redirect("/admin/reports");
}
