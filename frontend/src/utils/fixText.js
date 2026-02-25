// src/utils/fixText.js
export function fixText(input) {
  if (input == null) return "";
  let s = String(input);

  // Arreglos típicos de mojibake (UTF-8 leído como Latin-1 / Windows-1252)
  const map = {
    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",
    "Ã": "Á", "Ã‰": "É", "Ã": "Í", "Ã“": "Ó", "Ãš": "Ú",
    "Ã±": "ñ", "Ã‘": "Ñ",
    "Ã¼": "ü", "Ãœ": "Ü",
    "Âº": "º", "Âª": "ª",
    "Â¿": "¿", "Â¡": "¡",
    "â": "’", "â": "“", "â": "”",
    "â": "–", "â": "—",
    "â¢": "•",
    "Â": "", // clásico "Â " suelto
    "�": "", // char de reemplazo cuando ya viene roto
  };

  // aplica reemplazos varias pasadas (por si viene doble-encodificado)
  for (let i = 0; i < 2; i++) {
    let changed = false;
    for (const [bad, good] of Object.entries(map)) {
      if (s.includes(bad)) {
        s = s.split(bad).join(good);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return s;
}

export default fixText;