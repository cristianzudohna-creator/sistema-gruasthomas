// backend/src/common/utils/norm-role.ts
export function normRole(v: any) {
  const s = String(v ?? "").trim().toUpperCase();

  // espacios / guiones => _
  const cleaned = s
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  // aliases comunes
  if (cleaned === "CONTROL_DE_FLOTA" || cleaned === "CONTROLFLOTA") return "CONTROL_FLOTA";

  return cleaned;
}