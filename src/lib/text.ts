const MARKUP = /[<>]/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export function sanitizePlainText(
  raw: string | null | undefined,
  options: { min: number; max: number; label: string; required?: boolean },
): string | null {
  if (raw == null) return null;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  if (MARKUP.test(trimmed) || CONTROL.test(trimmed)) {
    throw new Error(`${options.label} düz metin olmalıdır.`);
  }
  if (trimmed.length < options.min) {
    throw new Error(`${options.label} en az ${options.min} karakter olmalıdır.`);
  }
  if (trimmed.length > options.max) {
    throw new Error(`${options.label} en fazla ${options.max} karakter olabilir.`);
  }
  return trimmed;
}

export function parseCustomExitReason(raw: string | null | undefined): string | null {
  return sanitizePlainText(raw, { min: 2, max: 250, label: "Çıkış nedeni" });
}

export function normalizeEmployeeCode(raw: string): string {
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9-]{2,32}$/.test(trimmed)) {
    throw new Error("Personel kodu 2-32 karakter olmalı; yalnızca harf, rakam ve tire kullanılabilir.");
  }
  return trimmed.toLocaleUpperCase("en-US");
}

export function slugCode(name: string): string {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "C",
    Ğ: "G",
    İ: "I",
    Ö: "O",
    Ş: "S",
    Ü: "U",
  };
  const replaced = [...name].map((char) => map[char] ?? char).join("");
  const slug = replaced
    .toLocaleUpperCase("en-US")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "REASON";
}
