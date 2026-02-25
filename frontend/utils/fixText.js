// Arregla mojibake típico: UTF-8 interpretado como ISO-8859-1/Windows-1252
export function fixText(input) {
  if (input === null || input === undefined) return "";
  const s = String(input);

  // Si NO tiene indicios de mojibake, no tocamos nada
  if (!/[�ÃÂ]/.test(s)) return s;

  try {
    // Convierte: bytes latin1 -> string utf8
    // (esto repara "RevisiÃ³n" etc. y muchas variantes)
    return decodeURIComponent(escape(s));
  } catch {
    // Fallback: deja el texto tal cual si algo falla
    return s;
  }
}