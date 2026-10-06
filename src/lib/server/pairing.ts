import "server-only";
import { ApiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmployeeCode } from "@/lib/text";
import { pairingBodySchema, parseBody } from "@/lib/validation";
import { asRow, unwrap } from "@/lib/server/rows";
import { assertRateLimit, requireUser } from "@/lib/server/session";

export async function linkDevice(authUserId: string, rawEmployeeCode: string, deviceName: string) {
  const admin = createAdminClient();
  const employeeCode = normalizeEmployeeCode(rawEmployeeCode);
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
      .eq("auth_user_id", authUserId)
      .eq("active", true)
      .neq("employee_id", employeeId)
      .limit(1),
  );
  if (Array.isArray(otherDevice) && otherDevice.length > 0) {
    throw new ApiError("Bu cihaz başka bir personele bağlı.", 400);
  }
  const activeDevices = unwrap(
    await admin
      .from("employee_devices")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("active", true)
      .neq("auth_user_id", authUserId)
      .order("last_seen_at", { ascending: true }),
  );
  const others = Array.isArray(activeDevices) ? activeDevices : [];
  const maxDevices = typeof employee.max_devices === "number" ? employee.max_devices : 1;
  const overflow = others.length - maxDevices + 1;
  if (overflow > 0) {
    const ids = others.slice(0, overflow).map((device) => String((device as { id?: unknown }).id ?? "")).filter(Boolean);
    if (ids.length > 0) {
      const removed = await admin.from("employee_devices").update({ active: false }).in("id", ids);
      if (removed.error) throw new ApiError("Cihaz bağlanamadı.", 500);
    }
  }
  const name = deviceName.replace(/[<>]/g, "").slice(0, 120) || "Telefon";
  const saved = await admin
    .from("employee_devices")
    .upsert(
      {
        employee_id: employeeId,
        auth_user_id: authUserId,
        device_name: name,
        active: true,
        paired_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "employee_id,auth_user_id" },
    )
    .select("id")
    .single();
  if (saved.error || !saved.data || typeof saved.data !== "object" || typeof (saved.data as { id?: unknown }).id !== "string") {
    throw new ApiError("Cihaz bağlanamadı.", 500);
  }
  return { id: (saved.data as { id: string }).id, employeeId };
}

export async function handlePairing(body: unknown, userAgent: string | null) {
  const input = parseBody(pairingBodySchema, body);
  const user = await requireUser();
  await assertRateLimit(user.id);
  const linked = await linkDevice(user.id, input.employeeCode, userAgent ?? "Telefon");
  const admin = createAdminClient();
  const employee = unwrap(await admin.from("employees").select("full_name").eq("id", linked.employeeId).maybeSingle());
  const name = employee && typeof employee === "object" && "full_name" in employee ? String(employee.full_name) : "";
  return { ok: true, fullName: name };
}
