# Local SEO Analysis — yourtrashdayteam.com

**Analyzed:** 2026-09-20 · **Live URL:** https://yourtrashdayteam.com/
**Method:** Rendered-DOM inspection (headless Chromium) of `/`, `/faq/`, `/reviews/` + robots/sitemap/OG fetch.

---

## 1. Local SEO Score: 46/100

| Dimension | Weight | Score | Grade |
|-----------|--------|-------|-------|
| GBP Signals | 25 | 8/25 | Low |
| Reviews & Reputation | 20 | 9/20 | Partial |
| Local On-Page SEO | 20 | 11/20 | Partial |
| NAP Consistency & Citations | 15 | 7/15 | Partial |
| Local Schema Markup | 10 | 7/10 | Good |
| Local Link & Authority | 10 | 4/10 | Low |
| **Total** | **100** | **46/100** | **Needs work** |

The site is technically clean (schema, sitemap, robots, OG all present and valid). The score is dragged down by three things that matter most for the local pack: **no city keyword in the ranking tags**, **no verifiable review signal on-page**, and the structural reality that this is a **brand-new co-branded entity with no GBP or citations of its own**.

---

## 2. Business Type: Service Area Business (SAB)

- "Serving the Charleston, SC area" in header/footer, no street address anywhere.
- Schema has `areaServed` (Place: Charleston, South Carolina) with **no** `address.streetAddress`.
- "We roll bins out... bring bins back" = mobile/on-site service.

**Effect on checks:** Embedded-map and physical-address-consistency checks are skipped (correct for SAB). Proximity/service-radius signals and citations matter more.

---

## 3. Industry Vertical: Home Services

Signals: service area language, "Licensed and insured", recurring weekly service, "free"-style flat pricing, no menu/inventory/listings. Correct schema target is a **HomeAndConstructionBusiness** subtype (or `LocalBusiness`), plus `Service` + `areaServed` — you already have the `Service` half.

---

## 4. GBP Optimization Checklist

| Signal | Status | Note |
|--------|--------|------|
| GBP embed / Maps iframe on page | ❌ Missing | No map, no place ID, no reviews widget |
| GBP CID / canonical profile link | ⚠️ Indirect | Links to **parent** profiles (Bin Boy, TDME) on `/reviews/`, none for this entity |
| Primary category alignment | N/A | No GBP for "Your Trash Day Team" itself |
| Business hours on page | ❌ Missing | No hours; "open now" is a top-5 local factor |
| Photos / video evidence | ❌ Missing | No service photos of crews/bins |
| Click-to-call | ✅ Present | `tel:8439553132` in header + footer |

**Core decision:** "Your Trash Day Team" is a joint offer between two companies that each already have their own Google Business Profile. You have two realistic paths:

- **(A) Treat it as a marketing landing page** for the two parent GBPs — then stop chasing its own local-pack ranking and instead make it convert + feed the parents' profiles (link to both GBPs prominently, drive reviews to the parents). This is what the site currently half-does.
- **(B) Stand up a real GBP** for the combined service (own name, category "Garbage collection service" / "Sanitation service", service-area set to Charleston metro). Only worth it if you'll manage reviews + posts + NAP for a third listing.

Right now it's stuck between the two. Pick one before optimizing further.

---

## 5. Review Health Snapshot

| Check | Finding |
|-------|---------|
| On-page rating claim | "Five-star Google reviewed" / "Two five-star crews" |
| `aggregateRating` schema | ❌ None on `/` or `/reviews/` |
| Visible review count | ❌ None |
| Review recency | ❌ Not shown |
| Real testimonials | ✅ Yes on `/reviews/`, attributed to parent brands |
| Owner-response / multi-platform | Links out to both parents' Google profiles |

You claim five stars but give Google (and shoppers) **nothing structured to read** — no count, no rating value, no recent dates. The testimonials on `/reviews/` are legit (pulled from the parent GBPs), which is the right, policy-safe approach. The gap is that none of it is machine-readable or dated. Do **not** fabricate an `aggregateRating` for the combined entity if it has no reviews of its own — that's a schema-spam risk. If you go Path B (own GBP), add `aggregateRating` once real reviews exist.

---

## 6. NAP Consistency Audit

| Field | Page HTML | Schema | Match |
|-------|-----------|--------|-------|
| Name | Your Trash Day Team | Your Trash Day Team | ✅ |
| Phone | 843-955-3132 (`tel:8439553132`) | +1-843-955-3132 | ✅ |
| Address | (none — SAB) | (none — SAB) | ✅ consistent |
| Area | "Charleston, SC area" | Charleston, South Carolina | ✅ |

Internally consistent. The real question is **cross-entity**: this phone/name will not match either parent's GBP NAP, so it builds no citation authority for the parents and starts from zero for itself. Decide whose NAP this page should reinforce.

---

## 7. Citation Presence Check

| Directory | Status |
|-----------|--------|
| Google Business Profile (own) | ❌ None detected |
| Yelp | ❌ No listing for "Your Trash Day Team" |
| BBB | ❌ None |
| Facebook business page | ❌ None linked |
| Bing Places | ❌ None (powers ChatGPT/Copilot) |
| Apple Business Connect | ❌ None |

Expected for a new co-brand. If Path B, submit to Bing Places, Apple Business Connect, Yelp, and the data aggregators. If Path A, skip citations for this domain and keep the parents' citations strong instead.

---

## 8. Local Schema Status — GOOD, with fixes

**Present & valid:** `WebSite`, `Organization`, `Service` (+ `Offer` $70/mo), `FAQPage`, `BreadcrumbList`, `CollectionPage`. JSON-LD parses clean. This is above average.

**Fixes:**
1. **Wrong top type.** `Organization` → use `LocalBusiness` (or `HomeAndConstructionBusiness`) so Google reads it as a local entity.
2. **No `geo`.** Add lat/long (5+ decimals) for Charleston even as an SAB.
3. **Single `areaServed`.** Expand `areaServed` to named towns you cover (Mount Pleasant, North Charleston, Summerville, James Island, etc.) — currently just "Charleston, South Carolina".
4. **No hours.** Add `openingHoursSpecification`.

Ready-to-paste patch for the `#organization` node:

```json
{
  "@type": ["Organization", "HomeAndConstructionBusiness"],
  "@id": "https://yourtrashdayteam.com/#organization",
  "name": "Your Trash Day Team",
  "url": "https://yourtrashdayteam.com/",
  "telephone": "+1-843-955-3132",
  "priceRange": "$70/month",
  "geo": { "@type": "GeoCoordinates", "latitude": 32.77650, "longitude": -79.93090 },
  "areaServed": [
    { "@type": "City", "name": "Charleston, SC" },
    { "@type": "City", "name": "Mount Pleasant, SC" },
    { "@type": "City", "name": "North Charleston, SC" },
    { "@type": "City", "name": "Summerville, SC" }
  ],
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    "opens": "08:00", "closes": "17:00"
  }]
}
```
(Confirm real coverage towns and hours before publishing — the memory note flags an open question about which GA/SC towns are actually served.)

---

## 9. Location Page Quality

Single-location SAB — no multi-location doorway risk (good). But **no dedicated service pages**: the two core services (weekly valet roll-out/roll-in **and** monthly bin washing) live only as sections on the homepage. Dedicated service pages are Whitespark's **#1 local organic factor**. This is your biggest on-page opportunity (see actions).

---

## 10. Top 10 Prioritized Actions

**CRITICAL**
1. **Put the city + service in the title tag.** Current: `Your Trash Day Team | The Bin Boy + Trash Day Made Easy` (zero local keyword). Change to e.g. `Charleston Bin Cleaning & Trash Valet | Your Trash Day Team`.
2. **Rewrite the H1 with local + service intent.** Current H1 is a slogan ("Clean bins. Easy trash days...") with no keyword. Add "Charleston" + "bin cleaning / trash valet" while keeping it readable.
3. **Decide GBP path (A vs B, Section 4).** Everything else depends on this.

**HIGH**
4. Fix schema top type to `HomeAndConstructionBusiness`, add `geo`, hours, and multi-city `areaServed` (patch above).
5. Build **two dedicated service pages** — `/trash-bin-cleaning-charleston/` and `/trash-can-valet-charleston/` — each with unique copy, local FAQs, and internal links back to signup.
6. Add business **hours** and **service photos** to the page (crews, before/after bins).

**MEDIUM**
7. Add a real, dated review element on `/reviews/` (embed the parents' Google reviews with visible dates/count) — no fabricated `aggregateRating` for the combined entity.
8. Expand meta description + on-page copy to name the specific towns served (currently only "Charleston").
9. Add local authority signals: Chamber of Commerce / BBB badges, and any "best of Charleston" placements.

**LOW**
10. Add `sameAs` links from the Organization schema to both parent brands' Google profiles and social pages to pass entity association.

---

## 11. Limitations

This analysis could **not** assess: geo-grid map-pack rank positions, actual GBP Insights (calls/direction requests), true backlink profile / Domain Authority, real-time local-pack position for "bin cleaning charleston" type queries, or whether "Your Trash Day Team" has any GBP at all (no API access). It reads only what the live site serves. Fill those gaps with a geo-grid tracker (Local Falcon), GBP dashboard access, and a backlink tool (Ahrefs/Moz). For AI-search visibility (AI Overviews / ChatGPT sourcing), run `/seo geo https://yourtrashdayteam.com/`.
