/** Helpers for interest accent hex from API (e.g. #F59E0B). */

export function hexRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  return null;
}

export function hexWithAlpha(hex: string, alphaHex2: string): string {
  const base = hex.startsWith("#") ? hex.slice(0, 7) : `#${hex.slice(0, 6)}`;
  return `${base}${alphaHex2}`;
}

export function darkenHex(hex: string, factor: number): string {
  const rgb = hexRgb(hex);
  if (!rgb) return hex;
  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function interestInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  const w = name.trim();
  if (w.length >= 2) return w.slice(0, 2).toUpperCase();
  return w.slice(0, 1).toUpperCase() || "?";
}
