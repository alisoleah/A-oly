/**
 * Tiny className combiner. No `clsx`/`tailwind-merge` dependency needed at this
 * scale (CLAUDE.md: ask before adding deps). Handles falsy values + objects.
 */
export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const v of inputs) {
    if (!v) continue;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      const nested = cn(...v);
      if (nested) out.push(nested);
    }
  }
  return out.join(" ");
}
