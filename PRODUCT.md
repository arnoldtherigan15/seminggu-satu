# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary, in priority order** (confirmed by Arnold, Nov 2026):

1. **Calon peserta workshop.** People discovering Seminggu Satu through an event page, a registration form (`reka-rekat/`, `paper-journal/`, `upcycle-journal/`, `side-by-side/`, `private-uc/`, `3d-frame-journaling/`, `bookmark-journal/`, `journaling-date/`), Instagram, or a friend. Many have never journaled and are not sure they are "creative enough". Their job: decide whether to join, pick a session, pay by transfer, and upload what the form asks for — almost always on a phone.
2. **Warga (members).** People who have joined at least one paid event. They use Balai Warga (`warga/`, public view at `balai/`) for weekly check-ins, journaling challenges, the gallery and likes, loyalty stamps and passport, birthday vouchers, Mochi's monthly letters, and buying products at events (`shop-bill/`).

**Secondary:**

- **Partners / venues** — cafes, venues and brands evaluating a collaboration through `/kolaborasi`.
- **Arnold (admin)** — runs registrations, event prep, attendance, shop/HPP, orders, finance and content through `/admin`.
- **International buyers of upcycled products** — reach `/upcycle-club` by scanning the QR on a product envelope.

## Product Purpose

Seminggu Satu by Arnold is a journaling and creative-workshop community based in Jakarta. It runs paid hands-on workshops and turns participants into a lasting community that journals together — the name means "one a week". Success is people coming back: a first-timer joins a workshop, becomes a warga, and keeps a small weekly journaling habit with others.

## Positioning

- **A community, not just a class.** People come for a workshop but stay for the warga, Balai Warga, and the shared weekly habit.
- **Beginner-friendly with an all-in kit.** No drawing skill or supplies needed; everything is prepared at the event.

## Operating Context

- Nearly every visit is on a phone, often opened from Instagram, WhatsApp, or a printed QR code (event table, product envelope). Some visitors use older Android phones with many tabs open and flaky access to gallery photos.
- Events are offline in Jakarta (cafes, malls, venues); buyers check out on the spot via a per-event shop QR and confirm by WhatsApp to Arnold.
- WhatsApp is the main channel for confirmations, invoices, and community groups; Telegram is used for Arnold's admin reminders.
- Event names in use: Reka Rekat (Journaling Date), Side by Side, Upcycle Journal (Private Session), Paper Journal, Pull & Pop Bookmark, 3D Layered Journaling.

## Capabilities and Constraints

- Static site on GitHub Pages; backend on Supabase (Postgres, Storage, Edge Functions, pg_cron), with separate dev and production projects switched by hostname (`env.js`).
- Member auth is custom (WhatsApp number + password), not Supabase Auth.
- Pages are hand-written HTML/CSS/JS per route; no build step or framework.
- Payment is manual bank transfer / QRIS with WhatsApp confirmation; there is no online payment gateway.
- Open decision: none recorded.

## Brand Commitments

- Name: **Seminggu Satu by Arnold**. Instagram: **@seminggu_satu**.
- Mascot: **Mochi** (`images/mochi_maskot_sm.png`), who writes letters and journaling prompts to warga.
- Logo: paw mark, `images/black.png` and `images/white.png`.
- Voice: **casual Indonesian** — "kamu", "nggak", "yuk", emoji in moderation. English only on pages for international audiences (e.g. `/upcycle-club`, which also offers `?lang=id`).
- The visual system for existing pages is documented in `.claude/skills/seminggu-ui`; the reasoning rules for any feature that touches warga's behaviour or feelings are in `.claude/skills/seminggu-psych`. Both stay binding.

## Evidence on Hand

- Real event photos: `kolaborasi/photos/` (IMG_5025, 5504, 5508, 6345, 7492).
- Real member content: Balai Warga gallery posts and likes, loyalty records, event registrations (in Supabase).
- Sourced carton facts used on `/upcycle-club` (Tetra Pak 2025, Deutsche Umwelthilfe 2014, Tetra Pak FY23).
- No testimonials, press, partner logos, or attendance totals are documented in the repo — do not invent them; ask Arnold.

## Product Principles

1. **Belonging over attendance.** Design for the second visit and the weekly habit, not only the first sign-up.
2. **Zero barrier to start.** A beginner with no skills or supplies should feel invited at every step; never imply you need to be artistic.
3. **Wellbeing, never guilt.** No streak punishment, fake urgency, guilt-based nudges, or social comparison pressure (see `seminggu-psych`).
4. **Phone-first, WhatsApp-native.** Flows must work one-handed on a phone and hand off cleanly to WhatsApp.
5. **Honest facts only.** Numbers, claims, and product details must be real and sourced.

## Accessibility & Inclusion

No formal standard has been set. Known needs: readable on small and older Android screens, tolerant of slow connections, and usable by people who are new to journaling and to the community.
