import { ApiError } from "@/lib/api-error";
import { AdminShell } from "@/components/admin/shell";
import { requirePanel } from "@/lib/server/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  let name = "";
  let role: "admin" | "viewer" = "admin";
  let configError = "";
  try {
    const panel = await requirePanel();
    name = panel.fullName;
    role = panel.role;
  } catch (error) {
    if (error instanceof ApiError && error.status >= 500) configError = error.message;
    else redirect("/admin/login");
  }
  if (configError) {
    return <main className="grid min-h-full place-items-center px-5 text-center">{configError}</main>;
  }
  return (
    <AdminShell name={name} role={role}>
      {children}
    </AdminShell>
  );
}
