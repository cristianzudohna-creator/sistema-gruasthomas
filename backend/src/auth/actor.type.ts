// ✅ Archivo: src/auth/actor.type.ts
import { Empresa, Role } from "@prisma/client";

export type Actor = {
  id: string;
  email: string;
  role?: Role | string;
  empresa?: Empresa | null;
} | null;

/** ✅ helper: convierte string a Empresa (o undefined/null) */
export function normalizeEmpresa(value: any): Empresa | null | undefined {
  const v = value === undefined ? undefined : value === null ? null : String(value).trim().toUpperCase();
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;

  if (v === "GRUAS_THOMAS") return Empresa.GRUAS_THOMAS;
  if (v === "INSPROTEL") return Empresa.INSPROTEL;

  // si llega basura, lo dejamos undefined para no romper tipado
  return undefined;
}

/** ✅ helper: normaliza actor (especialmente empresa) */
export function normalizeActor(raw: any): Actor {
  if (!raw) return null;

  return {
    id: String(raw.id),
    email: String(raw.email),
    role: raw.role,
    empresa: normalizeEmpresa(raw.empresa),
  };
}
