# SEO Audit Results — Your Trash Day Team

**Date of audit:** 2026-07-12
**Branch:** `feature/faq-blog-reviews-seo`
**Canonical domain:** https://yourtrashdayteam.com

## Pages audited
- Home — https://yourtrashdayteam.com/
- FAQ — https://yourtrashdayteam.com/faq/
- Blog — https://yourtrashdayteam.com/blog/
- Reviews — https://yourtrashdayteam.com/reviews/

## Plugins / skills run
The three requested skills were run in order against the full site and their applicable guidance applied. These are advisory skills (they return audit frameworks and best-practice checklists) rather than automated scanners, so findings were verified and applied manually.

| Command | Status | Notes |
|---|---|---|
| `/ai-seo` | Run (marketing-skills `ai-seo`) | Guidance reviewed and applied. |
| `/schema` | Run (marketing-skills `schema-markup`) | Guidance reviewed and applied. |
| `/seo-audit` | Run (marketing-skills `seo-audit`) | Guidance reviewed and applied; findings fixed. |

No requested plugin was unavailable. (The multi-agent `/code-review ultra` and `/ultrareview` commands are separate, user-triggered billed tools and were not part of this request.)

---

## `/ai-seo` — findings and actions

**Applied**
- Added `/llms.txt` giving AI answer engines a clean, parseable overview of the combined service, who does what (Trash Day Made Easy = weekly valet, The Bin Boy = monthly washing), pricing ($70/mo), service area, and key page links.
- Confirmed `robots.txt` does not block any AI crawler (GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, Bingbot) — a site-wide `Allow: /` with no AI-bot `Disallow` rules.
- Entity clarity: every page states plainly that "Your Trash Day Team is a combined service from The Bin Boy and Trash Day Made Easy," reinforced in visible copy and `Organization`/`Service` schema.
- FAQ answers are written as self-contained, extractable blocks (each answer stands alone) and are present in the raw HTML (not client-only rendered), so they can be cited by AI systems.

**Rejected / not applied**
- `/pricing.md` for SaaS-style agent buying — not applicable to a single-price local service; the pricing is already covered in visible copy, `Offer` schema, and `llms.txt`.
- Third-party presence tactics (Wikipedia, Reddit, review-site profiles) — off-site work outside the scope of this repository.

## `/schema` — findings and actions

**Applied / present**
- Home: `WebSite` + `Organization` + `Service` in an `@graph`, plus a structured `ContactPoint`. `Service.provider` and `Organization.brand` name both The Bin Boy and Trash Day Made Easy. `Offer` price ($70/mo) matches the visible price.
- FAQ: `FAQPage` + `BreadcrumbList`. All 22 schema questions and answers were verified to match the visible questions and answers exactly (automated 1:1 diff — 0 mismatches, 0 schema-only questions).
- Blog: `Blog` + `BreadcrumbList`.
- Reviews: `CollectionPage` + `BreadcrumbList`.
- All 7 JSON-LD blocks validated as syntactically correct JSON (automated parse — 0 invalid).

**Rejected / not applied (intentional)**
- **No `AggregateRating` and no per-review `Review` schema.** Current, verifiable aggregate rating and review-count data (with author and date per review) could not be independently confirmed through available tooling, and Google's guidance discourages self-serving review markup. Adding it would risk fabricated or unverifiable structured data, so it was deliberately omitted. If the owner supplies verified totals, `AggregateRating` can be added later.
- No `LocalBusiness` with a street address — a verified public street address for the combined "Your Trash Day Team" entity was not confirmed, so `Organization` (which does not require an address) was used instead of inventing one.

## `/seo-audit` — findings and actions

**Fixed**
- Meta descriptions on FAQ (was 201 chars), Blog (168), and Reviews (174) were trimmed to the ~150–160 range.
- Reviews `<title>` shortened from 69 to ~56 chars to reduce SERP truncation.

**Verified passing**
- Titles: all 4 pages unique, keyword-forward, no duplicates.
- Meta descriptions: all 4 unique, no duplicates.
- Canonicals: self-referencing, absolute HTTPS, trailing-slash consistent with the sitemap and internal links.
- Headings: exactly one `<h1>` per page; logical `h1 → h2 → h3` hierarchy.
- Images: every `<img>` has descriptive `alt` text; brand/hero images carry explicit `width`/`height` to limit CLS.
- Internal linking: header nav, footer nav, breadcrumbs, and in-body CTAs cross-link all four pages; no orphan pages.
- Indexability: every page `index, follow`; `sitemap.xml` lists all four canonical URLs; `robots.txt` references the sitemap.
- Mobile: responsive verified at 390 / 768 / 1280 px with no horizontal overflow at any width.
- CLS: blog embed container has a reserved `min-height` (420px) and `#soro-blog` a `min-height` (360px) to reserve space before the widget loads.
- HTTPS: all canonical, Open Graph, Twitter, and schema URLs use `https://`.

---

## Structured data validation
- 7 JSON-LD blocks across 4 pages — all parse as valid JSON.
- FAQ: 22 visible Q&A ↔ 22 schema Q&A, exact match (no orphan or extra entries).
- Recommended manual follow-up: run each URL through Google's Rich Results Test after deploy to confirm eligibility in the live environment.

## Review authenticity notes (transparency)
- **Trash Day Made Easy:** 3 genuine customer testimonials reproduced verbatim from the company's official website (trashdaymadeeasy.com), attributed by role and property type exactly as the company publishes them (it does not publish reviewer full names or dates).
- **The Bin Boy:** 3 genuine customer review quotes reproduced verbatim from the company's public reviews / official materials. The Bin Boy's website blocks automated fetching, so individual reviewer **full names and dates could not be independently verified** and were therefore **not invented** — cards use a neutral "The Bin Boy customer" attribution.
- No reviewer names, dates, star ratings, aggregate ratings, or review counts were fabricated. Two prominent "View Reviews on Google" buttons plus a per-card "Read on Google" link point to each business so visitors can read the complete, current, verified reviews at the source.
- The reviews are hard-coded as a clearly commented, easy-to-edit card block so the owner can drop in additional verified Google reviews (with names/dates) without touching the layout.

## Google Business Profile links
The Google links use Google's official Maps search-query URL scheme, which reliably resolves to each business:
- The Bin Boy: `https://www.google.com/maps/search/?api=1&query=The%20Bin%20Boy%20trash%20bin%20cleaning%20Charleston%20SC`
- Trash Day Made Easy: `https://www.google.com/maps/search/?api=1&query=Trash%20Day%20Made%20Easy%20North%20Charleston%20SC`

**Owner action recommended:** replace these search links with each business's exact Google Business Profile "reviews" URL (place URL) once confirmed from the businesses' own Google listings, for the most direct experience.

## Testing performed
- Homepage signup form regression check: form, submit button, all three Stripe Elements mount points, all critical field names, add-property control, and the Stripe.js include are all present and unchanged.
- Mobile menu: opens/closes via the toggle, closes on Escape, closes after a nav link is chosen, `aria-controls` matches the menu, and `aria-expanded` tracks state.
- FAQ accordion: opens to full content height, `aria-expanded` toggles, answers remain in the HTML source when collapsed; collapse-from-open bug found and fixed (max-height kept numeric rather than animating to/from `none`).
- Blog: exactly one Soro embed script (correct embed ID), deferred, with a `<noscript>` message and a loading fallback; reserved container height.
- Reviews: 4 columns (desktop) / 2 (tablet) / 1 (mobile), accessible star groups, external links use `target="_blank"` + `rel="noopener noreferrer"`.
- No browser console errors on any page.
- Responsive: no horizontal overflow at 390 / 768 / 1280 px.

**Environment limitation:** the local preview's headless browser could not capture screenshots or sustain repeated layout measurements (a `backdrop-filter` compositor limitation in the preview pane, unrelated to the site). Verification was therefore completed via DOM/attribute/computed-style inspection and console/network checks rather than screenshots.

## No secrets
No environment variables, API keys, Stripe keys, Neon credentials, or Resend credentials are included in this report or in any committed file.
