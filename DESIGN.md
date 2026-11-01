# Design

## Theme

Light page in warm paper tones with a navy-drenched hero and navy anchor sections. Scene: a homeowner on a phone at dusk, deciding whether to trust a local crew with a stored card; light surfaces keep the long form legible and trustworthy, while the deep navy opening sets the "evening before trash day" mood and makes the co-brand logos and gold price mark glow. Dark mode is not offered; the single audience-facing surface stays consistent.

## Color

Strategy: **Committed.** Deep navy carries the hero, the service panel, and the footer (roughly a third of the page); green is reserved for actions and confirmation; gold is the single punch accent (price mark, eyebrow ticks). All values OKLCH, neutrals tinted toward navy. Never pure #000 or #fff.

- `--navy: oklch(0.24 0.05 258)` — brand anchor, hero and footer surface (from The Bin Boy / TDME logo navy)
- `--navy-deep: oklch(0.19 0.045 260)` — hero gradient floor
- `--green: oklch(0.62 0.17 150)` — action color, buttons, checked states (logo green)
- `--green-press: oklch(0.53 0.15 151)` — hover/active
- `--gold: oklch(0.78 0.14 85)` — price mark, eyebrow ticks, footer links on navy
- `--paper: oklch(0.975 0.006 120)` — page background, warm green-tinted off-white
- `--card: oklch(0.99 0.004 120)` — raised light surfaces
- `--ink: oklch(0.25 0.03 258)` — body text on light
- `--muted: oklch(0.48 0.025 258)` — secondary text on light
- `--on-navy: oklch(0.93 0.015 240)` — body text on navy
- `--on-navy-muted: oklch(0.78 0.02 240)` — secondary text on navy
- `--line: oklch(0.88 0.012 250)` — hairlines on light
- `--danger: oklch(0.5 0.19 27)` / `--success: oklch(0.5 0.14 152)` — form feedback

## Typography

- **Display: Bricolage Grotesque** (Google Fonts, variable). Sturdy, characterful grotesque with workwear warmth; used for h1–h3 at heavy weights (700–800), tight line-height (0.95–1.05), slight negative tracking on the largest sizes.
- **Body/UI: Public Sans** (Google Fonts). Plain, civic, trustworthy; 400/600/700. Form labels 600, never 900.
- Scale ratio ≥1.3: hero `clamp(2.75rem, 6.5vw, 5.25rem)`, h2 `clamp(2rem, 4vw, 3.25rem)`, h3 ~1.5rem, body 1.0625rem, small 0.875rem.
- Body line length capped at 65ch. On navy, line-height +0.05.

## Components

- **Buttons:** pill radius, green fill with darker press state, 48px min height, ease-out-quart transitions on transform/box-shadow only. Secondary: outlined on light, translucent on navy.
- **Price mark:** rotated circular navy stamp with gold ring, the page's signature object. On mobile it flattens into a full-width band.
- **Form fields:** 12px radius, 48px min height, navy labels at 600, green focus ring, danger states with tinted background and inline message under the field.
- **Choice chips:** pill radio labels, green when checked, gold focus-visible outline.
- **Work-order ticket:** the signup's live summary. A navy "work order" card with gold kicker, dashed field rows, perforated tear line, and the monthly / due-today totals. It fills in as the visitor types (address, bins, trash day, recycling, upcoming route days) and gets a rotated gold "Submitted" stamp on success. Sticky beside the form on desktop; below the form on mobile, with a one-line navy strip (day · bins · $/month · $0 today) at the top of the form.
- **Stepped signup:** three steps (Your bins → Your info → Secure card) with a dot-and-rail stepper. Each step validates before advancing; Enter advances instead of submitting; final submit re-validates every step and jumps back to the first one with errors. Stripe Elements mount only when the card step is visible.
- **Trash week scene:** the "How it works" section is an illustrated, playable curb scene (inline SVG, a Charleston single house with piazza and a palmetto) beside a four-step rail: roll out → pickup → roll in → monthly wash. The sky, window light, bins, truck, and grime change per step; a gold "Your trips to the curb: 0" tally stays at zero. It autoplays once on scroll-in (3.8s per step, gold progress bar), pauses on hover/focus, stops when a step is tapped, and swaps in the visitor's trash day once they choose one in the hero planner or the form. Under 980px the rail becomes four short tabs and a caption sits under the scene. With no JS it shows the evening frame and all four steps as text; under reduced motion it never autoplays. The truck is a generic hauler, never branded.
- **Numbered lists over icon cards.** Pain points and steps use leading numbers, not icon+heading card grids.
- No side-stripe accents, no gradient text, no glassmorphism, no identical card grids.

## Layout

- Container `min(1140px, 100% - 3rem)`; asymmetric two-column heroes and splits, left-aligned type.
- Section padding fluid: `clamp(4rem, 9vw, 7.5rem)` with tighter internal groupings for rhythm; navy and paper sections alternate to pace the scroll.
- The signup section is the destination: sticky work-order ticket on desktop, single column under 980px with the ticket after the form.

## Motion

- One orchestrated entrance on the hero (staggered fade-rise, 500–700ms, ease-out-quint), scroll-triggered single-fire reveals on section heads via IntersectionObserver.
- Transform/opacity only, never layout properties. Everything collapses under `prefers-reduced-motion`.
