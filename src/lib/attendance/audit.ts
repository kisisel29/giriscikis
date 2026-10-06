export function buildAuditEntry(input: {
  adminUserId: string;
  action: string;
  tableName: string;
  recordId: string;
  oldData: unknown;
  newData: unknown;
  reason: string;
}): {
  admin_user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data: unknown;
  new_data: unknown;
  reason: string;
} {
  const reason = input.reason.replace(/\s+/g, " ").trim();
  if (reason.length < 5) {
    throw new Error("Düzeltme nedeni zorunludur.");
  }
  if (reason.length > 500) {
    throw new Error("Düzeltme nedeni en fazla 500 karakter olabilir.");
  }
  if (/[<>]/.test(reason)) {
    throw new Error("Düzeltme nedeni düz metin olmalıdır.");
  }
  return {
    admin_user_id: input.adminUserId,
    action: input.action,
    table_name: input.tableName,
    record_id: input.recordId,
    old_data: input.oldData,
    new_data: input.newData,
    reason,
  };
}
