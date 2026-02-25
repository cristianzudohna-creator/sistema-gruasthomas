export function normRole(input: any): string {
  const r = String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_"); // espacios o guiones => "_"

  // ✅ alias: "CONTROL DE FLOTA" => "CONTROL_FLOTA"
  if (r === "CONTROL_DE_FLOTA") return "CONTROL_FLOTA";

  return r;
}