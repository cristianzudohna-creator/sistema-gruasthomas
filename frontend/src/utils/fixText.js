export function fixText(value) {
  const s = String(value ?? "");
  if (!s) return s;

  const map = {
    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",
    "Ã\u0081": "Á", "Ã‰": "É", "Ã\u008d": "Í", "Ã“": "Ó", "Ã\u009a": "Ú",
    "Ã±": "ñ", "Ã‘": "Ñ",
    "Â¿": "¿", "Â¡": "¡",
    "Â°": "°",
    "â€“": "–", "â€”": "—",
    "â€œ": "“", "â€\u009d": "”",
    "â€˜": "‘", "â€™": "’",
    "â€¢": "•",
  };

  let out = s;
  for (const [bad, good] of Object.entries(map)) {
    out = out.split(bad).join(good);
  }
  return out.replace(/Â/g, "");
}