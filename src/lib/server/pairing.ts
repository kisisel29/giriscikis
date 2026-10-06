import "server-only";
import { ApiError } from "@/lib/api-error";
import { hashPairingCode } from "@/lib/pairing";
import { createAdminClient, pairingPepper } from "@/lib/supabase/admin";
import { normalizeEmployeeCode } from "@/lib/text";
import { pairingBodySchema, parseBody } from "@/lib/validation";
import { asRow, unwrap } from "@/lib/server/rows";
import { assertRateLimit, requireUser } from "@/lib/server/session";

export async function handlePairing(body: unknown, userAgent: string | null) {
  const input = parseBody(pairingBodySchema, body);
  const user = await requireUser();
  await assertRateLimit(user.id);
  const admin = createAdminClient();
  const result = await admin.rpc("consume_pairing_code", {
    p_auth_user_id: user.id,
    p_employee_code: normalizeEmployeeCode(input.employeeCode),
    p_code_hash: hashPairingCode(input.pairingCode, pairingPepper()),
    p_device_name: (userAgent ?? "Telefon").replace(/[<>]/g, "").slice(0, 120),
  });
  const data = unwrap(result);
  const record = asRow(data);
  if (record.ok !== true) {
    const message = typeof record.error === "string" ? record.error : "Personel kodu veya eşleştirme kodu hatalı.";
    throw new ApiError(message, 400);
  }
  return { ok: true, fullName: typeof record.fullName === "string" ? record.fullName : "" };
}
