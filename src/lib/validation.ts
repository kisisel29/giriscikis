import { z } from "zod";

const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${label} en az ${min} karakter olmalıdır.`)
    .max(max, `${label} en fazla ${max} karakter olabilir.`)
    .refine((value) => !/[<>]/.test(value), `${label} düz metin olmalıdır.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !/[<>]/.test(value), "Düz metin olmalıdır.")
    .nullable()
    .optional();

const clock = z.string().regex(/^\d{2}:\d{2}$/, "Saat HH:mm formatında olmalıdır.");

export const locationBodySchema = z.object({
  latitude: z.number().finite().gte(-90).lte(90).nullable(),
  longitude: z.number().finite().gte(-180).lte(180).nullable(),
  accuracy: z.number().finite().gte(0).lte(100000).nullable(),
});

export const nfcBodySchema = locationBodySchema.extend({
  tagPublicId: z.uuid("NFC etiketi tanınmadı."),
  employeeCode: z.string().trim().min(2).max(32).optional(),
});

export const exitBodySchema = nfcBodySchema.extend({
  exitReasonId: z.uuid().nullable().optional(),
  customExitReason: z.string().max(250).nullable().optional(),
});

export const pairingBodySchema = z.object({
  employeeCode: z.string().trim().min(2).max(32),
});

export const setupSchema = z.object({
  organizationName: text("Kurum adı", 2, 120),
  latitude: z.number().finite().gte(-90).lte(90),
  longitude: z.number().finite().gte(-180).lte(180),
  allowedRadiusMeters: z.number().int().gte(10).lte(5000),
  workStart: clock,
  workEnd: clock,
  entryTagName: text("Giriş etiketi adı", 2, 80),
  entryLocation: optionalText(80),
  exitTagName: text("Çıkış etiketi adı", 2, 80),
  exitLocation: optionalText(80),
  adminName: text("Yönetici adı", 2, 120),
  adminEmail: z.email("Geçerli bir e-posta girin."),
  adminPassword: z.string().min(8, "Şifre en az 8 karakter olmalıdır.").max(72),
  employeeName: text("Personel adı", 2, 120),
  employeeCode: z.string().trim().min(2).max(32),
  department: optionalText(120),
  title: optionalText(120),
});

export const employeeSchema = z.object({
  employeeCode: z.string().trim().min(2).max(32),
  fullName: text("Ad soyad", 2, 120),
  department: optionalText(120),
  title: optionalText(120),
  workStart: clock,
  workEnd: clock,
  maxDevices: z.number().int().gte(1).lte(10).optional(),
  active: z.boolean().optional(),
});

export const nfcTagSchema = z.object({
  name: text("Etiket adı", 2, 80),
  locationName: optionalText(80),
  mode: z.enum(["ENTRY", "EXIT", "UNIVERSAL"]),
  active: z.boolean().optional(),
});

export const exitReasonSchema = z.object({
  name: text("Neden adı", 2, 80),
  code: z.string().trim().max(40).optional(),
  category: z.enum(["OFFICIAL", "MEAL", "HEALTH", "PERSONAL", "END_OF_DAY", "OTHER"]),
  allowNote: z.boolean().optional(),
  sortOrder: z.number().int().gte(0).lte(1000).optional(),
  active: z.boolean().optional(),
});

export const settingsSchema = z.object({
  organizationName: text("Kurum adı", 2, 120),
  latitude: z.number().finite().gte(-90).lte(90),
  longitude: z.number().finite().gte(-180).lte(180),
  allowedRadiusMeters: z.number().int().gte(10).lte(5000),
  locationVerificationRequired: z.boolean(),
  timezone: z.string().trim().min(3).max(64),
  defaultWorkStart: clock,
  defaultWorkEnd: clock,
  duplicateWindowSeconds: z.number().int().gte(5).lte(300),
  endOfDaySuggestionMinutes: z.number().int().gte(0).lte(180),
  storeRawCoordinates: z.boolean(),
});

export const correctionSchema = z.object({
  eventType: z.enum(["ENTRY", "EXIT", "RETURN", "END_OF_DAY"]),
  eventTime: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Geçerli bir zaman girin."),
  exitReasonId: z.uuid().nullable().optional(),
  customExitReason: z.string().max(250).nullable().optional(),
  exitCategory: z.enum(["OFFICIAL", "MEAL", "HEALTH", "PERSONAL", "END_OF_DAY", "OTHER"]).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  reason: text("Düzeltme nedeni", 5, 500),
});

export function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Geçersiz istek.");
  }
  return result.data;
}
