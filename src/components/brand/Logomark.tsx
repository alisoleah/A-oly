import type { SVGProps } from "react";

/**
 * aïoly logomark — the real vector brand mark (from aioly-brand.html).
 *
 * Four arcs forming a circle (three charcoal + one bronze accent on the bottom),
 * a bronze center dot, and two bronze diaeresis dots above — a stylized "aï".
 *
 * This is the authoritative mark: vector, transparent background, crisp at any
 * size. Colors are the exact brand identity values (charcoal #1A1A18, bronze
 * #B8926A), not the site tokens — the mark must not drift from the brand book.
 *
 * Props pass through to <svg> so callers can set className/width/height.
 */
export type MarkVariant = "light" | "dark" | "bronze";

const COLORS: Record<MarkVariant, { stroke: string; accent: string; dot: string }> = {
  // For use on ivory backgrounds (default header/footer).
  light: { stroke: "#1A1A18", accent: "#B8926A", dot: "#B8926A" },
  // For use on charcoal/dark backgrounds.
  dark: { stroke: "#F7F4EE", accent: "#B8926A", dot: "#B8926A" },
  // Single-tone for monochrome contexts.
  bronze: { stroke: "#B8926A", accent: "#B8926A", dot: "#B8926A" },
};

export function Logomark({
  variant = "light",
  ...props
}: SVGProps<SVGSVGElement> & { variant?: MarkVariant }) {
  const { stroke, accent, dot } = COLORS[variant];
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="aïoly mark"
      {...props}
    >
      {/* Top arc */}
      <path d="M45 28 Q60 10 75 28" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Right arc */}
      <path d="M92 45 Q110 60 92 75" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Bottom arc — bronze accent */}
      <path d="M75 92 Q60 110 45 92" stroke={accent} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Left arc */}
      <path d="M28 75 Q10 60 28 45" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Center dot */}
      <circle cx="60" cy="60" r="3.5" fill={dot} />
      {/* Diaeresis dots */}
      <circle cx="52" cy="14" r="2" fill={dot} />
      <circle cx="68" cy="14" r="2" fill={dot} />
    </svg>
  );
}
