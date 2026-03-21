/** Parse rgba()/rgb() for streak SVG stops (bloom, seal inner wash). */
export function parseRgba(rgba: string): { r: number; g: number; b: number; a: number } {
  const m = rgba.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i
  );
  if (!m) return { r: 109, g: 40, b: 217, a: 0.28 };
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] !== undefined ? Number(m[4]) : 1,
  };
}

export function rgbaToRgb({ r, g, b }: { r: number; g: number; b: number }): string {
  return `rgb(${r},${g},${b})`;
}
