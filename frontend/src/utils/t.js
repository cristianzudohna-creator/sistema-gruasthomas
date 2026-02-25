// ✅ Archivo: src/utils/t.js
import { fixText } from "./fixText";

/**
 * t(value): normaliza texto para UI
 * - null/undefined => ""
 * - arregla mojibake
 * - trim suave
 */
export function t(value) {
  return fixText(value ?? "").toString();
}