import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "20261006120000_init.sql"),
  "utf8",
);

describe("migration", () => {
  it("tabloları, rls politikalarını ve indeksleri kurar", () => {
    for (const table of [
      "employees",
      "employee_devices",
      "pairing_codes",
      "nfc_tags",
      "exit_reasons",
      "attendance_events",
      "organization_settings",
      "audit_logs",
      "admin_users",
      "attendance_attempts",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain("attendance_events_employee_time_idx");
    expect(sql).toContain("attendance_events (employee_id, event_time desc)");
    expect(sql).toContain("attendance_events_time_idx");
    expect(sql).toContain("employee_devices_auth_user_idx");
    expect(sql).toContain("employees_employee_code_idx");
    expect(sql).toContain("nfc_tags_public_id_idx");
    expect(sql).toContain("exit_reasons_active_sort_idx");
    expect(sql).toContain("is_admin()");
    expect(sql).toContain("current_employee_id()");
    expect(sql).toContain("force_server_event_time");
    expect(sql).toContain("DUPLICATE_EVENT");
    expect(sql).toContain("OFFICIAL_FIELD");
    expect(sql).toContain("custom_exit_reason");
    expect(sql).toContain("store_raw_coordinates");
    expect(sql).not.toMatch(/create policy[\s\S]*for insert/i);
  });
});
