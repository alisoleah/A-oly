# aïoly — Design System

The site is the brand. Restraint is the aesthetic: ivory field, ink text, one gold accent, photography doing the talking. If a screen looks busy, remove elements until it doesn't.

## 1. Tokens (Tailwind theme — the only colors allowed)

```css
:root {
  /* Palette */
  --ivory:      #F5F1EA;  /* page background — never pure white */
  --ivory-deep: #EDE7DC;  /* cards, section alternation */
  --ink:        #1A1A1A;  /* primary text, primary buttons */
  --ink-soft:   #4A4A46;  /* secondary text */
  --gold:       #A9814F;  /* THE accent: one use per view max */
  --gold-soft:  #C4A67F;  /* hover/active state of gold */
  --line:       #D9D2C5;  /* hairline borders, dividers */
  --error:      #8C3B2E;  /* muted brick, never bright red */
  --success:    #5A6B4F;  /* muted olive */

  /* Type */
  --font-display: "Cormorant Garamond", Georgia, serif;   /* headings, wordmark contexts */
  --font-body:    "Inter", -apple-system, sans-serif;      /* UI, body, prices */

  /* Spacing: 4px base — use steps 1,2,3,4,6,8,12,16,24,32 (×4px) */
  /* Radius */
  --radius-none: 0;        /* default: sharp edges are part of the look */
  --radius-pill: 999px;    /* only: quantity stepper, filter chips */

  /* Motion */
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 150ms; --dur-base: 300ms; --dur-slow: 600ms;
}
```

Rules: gold appears at most once per viewport (a CTA, a price, or an accent — never several). No shadows except a 1px `--line` border; elevation is expressed by background shift to `--ivory-deep`. No pure `#FFF` or `#000` anywhere.

## 2. Typography

| Role | Font | Size / line | Weight | Case |
|---|---|---|---|---|
| Display (home hero, collection titles) | Cormorant Garamond | 56/64 desktop, 36/44 mobile | 500 | lowercase, tracking +0.01em |
| H2 section | Cormorant Garamond | 32/40 | 500 | lowercase |
| H3 / product name | Inter | 18/28 | 500 | Sentence case |
| Body | Inter | 16/26 | 400 | — |
| Small / meta / breadcrumbs | Inter | 13/20 | 400 | uppercase, tracking +0.08em, `--ink-soft` |
| Price | Inter | 16/24 | 500 | tabular-nums |
| Button label | Inter | 14/20 | 500 | uppercase, tracking +0.1em |

The lowercase display treatment echoes the wordmark. Never set the wordmark in another font — use the SVG logo asset.

## 3. Layout

- Max content width 1280px; page gutter 24px mobile / 48px desktop.
- 12-col grid desktop, 4-col mobile; gaps 24px.
- Whitespace is generous by default: section vertical padding 96px desktop / 56px mobile.
- Header: transparent over hero, solid `--ivory` on scroll; logo center on mobile, left on desktop; right: search, cart (count in gold), no hamburger clutter — nav is 4 links max (Aether, Aethra, About, Journal).
- Footer: ivory-deep, three columns (shop, house, care), newsletter field, payment method marks (Visa/MC/Apple Pay/Google Pay/COD).

## 4. Imagery

- Product cards: 4:5 portrait, edge-to-edge image, name + price below on ivory (no text overlays on product photos).
- PDP gallery: full-bleed left column (60%), sticky buy panel right (40%); mobile: swipe gallery then panel.
- Photography direction: natural light, hard shadows welcome, fabric texture unretouched, motion (walking/turning) over static poses; backgrounds neutral or architectural, never busy.
- Every PDP includes one short drape video (muted, loop, playsinline) — the brand's signature "fabric in motion" asset.
- next/image everywhere, explicit `sizes`, LQIP blur placeholder tinted `--ivory-deep`.

## 5. Components (build exactly these primitives, nothing more)

- **Button**: variants `primary` (ink bg, ivory text), `gold` (gold bg — checkout CTA only), `ghost` (ink text, 1px line border). Height 48px, radius 0, uppercase label, hover: background shifts toward `--gold-soft`/`--ink-soft` over `--dur-fast`.
- **Input / Select**: 48px, ivory bg, 1px `--line` border, focus border `--ink` (no glow rings), label 13px uppercase above. Error: `--error` border + message.
- **ProductCard**: image, name, price, colorway dots (12px, 1px line border, selected = gold ring). Hover: image swaps to second shot, `--dur-base`.
- **SizeSelector**: row of square 44px cells; selected = ink fill/ivory text; out of stock = strikethrough + disabled with "notify me" link.
- **QuantityStepper**: pill, − / n / +.
- **Drawer (cart)**: right side, ivory, 420px, hairline divider rows, subtotal + gold "checkout" button; free-shipping progress line in `--ink-soft`.
- **Toast**: bottom center, ink bg, ivory text, 3s.
- **Badge**: uppercase 11px — only "new" and "low stock" (never fake urgency).
- **Payment method selector** (checkout): radio cards — "Pay by card / Apple Pay / Google Pay" and "Cash on delivery" — equal visual weight; wallet buttons render inside the online option only when device-supported.

## 6. Checkout experience

- Single page, three collapsed steps: contact → delivery → payment; each step summarizes when complete ("edit" link).
- Order summary sticky on desktop, collapsible on mobile (starts collapsed with total visible).
- COD selected → note: "Please prepare EGP {total} for the courier. Card payment on delivery not available."
- Trust row under the pay button: hairline icons for secure payment, easy returns, Cairo atelier. No badges salad.
- After online payment: "confirming your payment…" state with subtle gold progress; never show success until the server confirms (webhook-driven status).

## 7. Motion & interaction

- One principle: things settle, they don't bounce. `--ease`, opacity+translateY(8px) reveals on scroll (once, no re-trigger), image crossfades `--dur-base`.
- No parallax, no autoplaying carousels with controls hidden, no marquee.
- Respect `prefers-reduced-motion`: disable all non-essential transitions.

## 8. Accessibility & i18n

- Contrast: ink on ivory passes AAA; gold on ivory is decorative/large-text only — never body copy.
- Focus visible: 2px ink outline offset 2px (do not remove).
- All controls keyboard operable; cart drawer traps focus; images get real alt text (garment, colorway, context).
- Use CSS logical properties throughout; copy in message files — Arabic/RTL is a config change, not a rewrite.
