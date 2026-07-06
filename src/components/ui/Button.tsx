import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Button — the single CTA primitive (design-system.md §5).
 * Variants: primary (ink/ivory), gold (checkout CTA only), ghost (ink, 1px line).
 * Height 48px, radius 0, uppercase label, hover shifts toward gold-soft/ink-soft.
 *
 * Renders <a> when href is given, <button> otherwise. Never both gold and ghost.
 */
type Variant = "primary" | "gold" | "ghost";

const base =
  "inline-flex items-center justify-center h-12 px-8 text-sm font-medium uppercase " +
  "tracking-[0.1em] transition-colors duration-[var(--animate-duration-fast)] " +
  "ease-[var(--ease-brand)] disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-ivory hover:bg-ink-soft",
  // gold is the single accent — checkout CTA only
  gold: "bg-gold text-ivory hover:bg-gold-soft",
  ghost: "bg-transparent text-ink border border-line hover:border-ink-soft",
};

type CommonProps = {
  variant?: Variant;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ComponentProps<"button">, "className" | "children"> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<ComponentProps<typeof Link>, "className" | "children"> & { href: string };

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", className, children, ...rest } = props;
  const classes = cn(base, variants[variant], className);

  if ("href" in props && props.href !== undefined) {
    return (
      <Link className={classes} {...(rest as ComponentProps<typeof Link>)}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...(rest as ComponentProps<"button">)}>
      {children}
    </button>
  );
}
