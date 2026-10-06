import "server-only";
import { ApiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmployeeCode } from "@/lib/text";
import { pairingBodySchema, parseBody } from "@/lib/validation";
import { asRow, unwrap } from "@/lib/server/rows";
import { assertRateLimit, requireUser } from "@/lib/server/session";

export async function handlePairing(body: unknown, userAgent: string | null) {
  const input = parseBody(pairingBodySchema, body);
  const user = await requireUser();
  await assertRateLimit(user.id);
  const admin = createAdminClient();
  const employeeCode = normalizeEmployeeCode(input.employeeCode);
  const employeeRow = unwrap(
    await admin.from("employees").select("id, full_name, active, max_devices").eq("employee_code", employeeCode).maybeSingle(),
  );
  if (!employeeRow) throw new ApiError("Personel kodu bulunamadı.", 400);
  const employee = asRow(employeeRow);
  if (employee.active !== true) throw new ApiError("Personel kodu bulunamadı.", 400);
  const employeeId = String(employee.id);
  const otherDevice = unwrap(
    await admin
      .from("employee_devices")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .neq("employee_id", employeeId)
      .limit(1),
  );
  if (Array.isArray(otherDevice) && otherDevice.length > 0) {
    throw new ApiError("Bu cihaz başka bir personele bağlı.", 400);
  }
  const activeDevices = unwrap(
    await admin.from("employee_devices").select("id").eq("employee_id", employeeId).eq("active", true).neq("auth_user_id", user.id),
  );
  const activeCount = Array.isArray(activeDevices) ? activeDevices.length : 0;
  const maxDevices = typeof employee.max_devices === "number" ? employee.max_devices : 1;
  if (activeCount >= maxDevices) {
    throw new ApiError("Bu personel için cihaz limiti dolu. Yöneticiden mevcut cihaz bağlantısını kaldırmasını isteyin.", 400);
  }
  const deviceName = (userAgent ?? "Telefon").replace(/[<>]/g, "").slice(0, 120) || "Telefon";
  const saved = await admin.from("employee_devices").upsert(
    {
      employee_id: employeeId,
      auth_user_id: user.id,
      device_name: deviceName,
      active: true,
      paired_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "employee_id,auth_user_id" },
  );
  if (saved.error) throw new ApiError("Cihaz bağlanamadı.", 500);
  return { ok: true, fullName: typeof employee.full_name === "string" ? employee.full_name : "" };
}
